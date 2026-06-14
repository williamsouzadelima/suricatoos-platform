package providers

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"sort"
	"strings"

	"suricatoos/pkg/database"
	"suricatoos/pkg/providers/pconfig"
	"suricatoos/pkg/providers/provider"

	"github.com/invopop/jsonschema"
	"github.com/vxcontrol/langchaingo/llms"
)

// findingsReflector mirrors tools.reflector (unexported there) so the submit_findings
// tool schema is generated the same expanded, reference-free way the agent tools are.
var findingsReflector = &jsonschema.Reflector{DoNotReference: true, ExpandedStruct: true}

const submitFindingsToolName = "submit_findings"

// Limits keep the prompt within the provider's simple-options token budget (DeepSeek caps
// at 4000 output tokens), so the structured findings JSON does not get truncated.
const (
	maxDeriveTasks      = 24
	maxFindings         = 12
	maxTaskResultChars  = 900
	maxSubtaskChars     = 400
	maxReportChars      = 1200
	maxTerminalBudget   = 7000
	derivePromptBudget  = 26000
)

// LLMRef is a documentation reference attached to a finding.
type LLMRef struct {
	Label string `json:"label" jsonschema:"required"`
	URL   string `json:"url,omitempty"`
}

// LLMFinding is one structured finding the report analyst returns via submit_findings.
type LLMFinding struct {
	Title          string            `json:"title" jsonschema:"required"`
	Severity       string            `json:"severity" jsonschema:"required,enum=critical,enum=high,enum=medium,enum=low,enum=info"`
	CVSSScore      float64           `json:"cvss_score,omitempty"`
	CVSSVector     string            `json:"cvss_vector,omitempty"`
	CWE            string            `json:"cwe,omitempty"`
	Category       string            `json:"category,omitempty"`
	Affected       []string          `json:"affected,omitempty"`
	Description    string            `json:"description" jsonschema:"required"`
	BusinessImpact string            `json:"business_impact,omitempty"`
	Likelihood     int               `json:"likelihood,omitempty"`
	Impact         int               `json:"impact,omitempty"`
	Remediation    string            `json:"remediation,omitempty"`
	References     []LLMRef          `json:"references,omitempty"`
	Evidence       string            `json:"evidence,omitempty"`
	SourceTaskIDs  []int64           `json:"source_task_ids,omitempty"`
	Provenance     map[string]string `json:"provenance,omitempty"`
}

// FindingsReport is the submit_findings payload.
type FindingsReport struct {
	Findings []LLMFinding `json:"findings" jsonschema:"required"`
	Summary  string       `json:"summary,omitempty"`
}

const findingsDeriverSystemPrompt = `You are a senior penetration-test report analyst working on an AUTHORIZED engagement. ` +
	`You are given the recorded execution of a completed automated pentest flow (tasks, subtasks, per-task summaries and real tool output). ` +
	`Read it and extract concrete, de-duplicated SECURITY FINDINGS, then return them by calling the ` + submitFindingsToolName + ` function. ` +
	`Do NOT answer in free text — your entire answer must be the tool call.

For each finding provide: a concise title; severity (critical|high|medium|low|info); a CVSS v3.1 vector and base score; CWE (e.g. "CWE-89"); a category (e.g. "Web Application", "Network", "Active Directory", "Configuration"); the affected assets (host[:port] or URL) taken ONLY from the execution; a clear description; the business impact; likelihood and impact each 1-5; concrete remediation; references (OWASP/CWE/CVE) when applicable; the source_task_ids the finding was derived from; and a provenance map.

HONESTY RULES (mandatory):
- Use ONLY information present in the execution. NEVER invent CVEs, hosts, ports or results that are not in the data.
- You derived severity/CVSS/CWE by reasoning, so mark them as inferred in the provenance map, e.g. {"severity":"inferred","cvss":"inferred","cwe":"inferred"}. NEVER claim "measured".
- If the execution shows no security-relevant issue, return an empty findings array.
- Be precise and conservative; do not inflate severity.

Produce at most ` + "12" + ` of the most important findings. Keep descriptions tight so the full JSON fits in one response. Write all finding text in the engagement language: %s.`

// DeriveFindings runs the report-analyst LLM over a finished flow's recorded execution and
// persists structured findings. It is idempotent + cached: if a finished derivation already
// exists that is not older than the flow's last update, it is returned without calling the LLM.
func (pc *providerController) DeriveFindings(ctx context.Context, flowID int64) (database.FindingDerivation, error) {
	flow, err := pc.db.GetFlow(ctx, flowID)
	if err != nil {
		return database.FindingDerivation{}, fmt.Errorf("failed to load flow %d: %w", flowID, err)
	}

	// Dirty-check / cache: reuse a fresh finished derivation.
	if latest, lerr := pc.db.GetLatestFlowDerivation(ctx, flowID); lerr == nil {
		if latest.Status == "finished" && latest.CreatedAt.Valid &&
			(!flow.UpdatedAt.Valid || !latest.CreatedAt.Time.Before(flow.UpdatedAt.Time)) {
			return latest, nil
		}
		// Guard against concurrent in-flight derivations.
		if latest.Status == "created" || latest.Status == "running" {
			return latest, nil
		}
	} else if lerr != sql.ErrNoRows {
		return database.FindingDerivation{}, fmt.Errorf("failed to check derivations: %w", lerr)
	}

	run, err := pc.db.CreateFindingDerivation(ctx, database.CreateFindingDerivationParams{
		FlowID:   flowID,
		Status:   "running",
		Model:    toNullString(flow.Model),
		Provider: toNullString(flow.ModelProviderName),
	})
	if err != nil {
		return database.FindingDerivation{}, fmt.Errorf("failed to create derivation: %w", err)
	}

	report, derr := pc.runFindingsLLM(ctx, flow)
	if derr != nil {
		updated, uerr := pc.db.UpdateFindingDerivationStatus(ctx, database.UpdateFindingDerivationStatusParams{
			Status: "failed", Summary: sql.NullString{}, Error: toNullString(derr.Error()), ID: run.ID,
		})
		if uerr != nil {
			return run, fmt.Errorf("derive failed (%v) and status update failed: %w", derr, uerr)
		}
		return updated, fmt.Errorf("findings derivation failed: %w", derr)
	}

	// Replace prior findings for this flow with the new run atomically enough for v1.
	if err := pc.db.DeleteFlowFindings(ctx, flowID); err != nil {
		return run, fmt.Errorf("failed to clear previous findings: %w", err)
	}
	for _, f := range report.Findings {
		if _, err := pc.db.CreateFinding(ctx, llmFindingToParams(flowID, run.ID, f)); err != nil {
			return run, fmt.Errorf("failed to persist finding: %w", err)
		}
	}

	updated, err := pc.db.UpdateFindingDerivationStatus(ctx, database.UpdateFindingDerivationStatusParams{
		Status: "finished", Summary: toNullString(report.Summary), Error: sql.NullString{}, ID: run.ID,
	})
	if err != nil {
		return run, fmt.Errorf("failed to finalize derivation: %w", err)
	}
	return updated, nil
}

// runFindingsLLM loads the flow execution, calls the provider with the submit_findings tool and
// parses the structured result.
func (pc *providerController) runFindingsLLM(ctx context.Context, flow database.Flow) (*FindingsReport, error) {
	prv, err := pc.GetProvider(ctx, provider.ProviderName(flow.ModelProviderName), flow.UserID)
	if err != nil {
		return nil, fmt.Errorf("failed to get provider %q: %w", flow.ModelProviderName, err)
	}

	human, err := pc.buildFindingsContext(ctx, flow)
	if err != nil {
		return nil, err
	}

	lang := flow.Language
	if lang == "" {
		lang = "English"
	}
	messages := []llms.MessageContent{
		{Role: llms.ChatMessageTypeSystem, Parts: []llms.ContentPart{llms.TextContent{Text: fmt.Sprintf(findingsDeriverSystemPrompt, lang)}}},
		{Role: llms.ChatMessageTypeHuman, Parts: []llms.ContentPart{llms.TextContent{Text: human}}},
	}
	tool := llms.Tool{
		Type: "function",
		Function: &llms.FunctionDefinition{
			Name:        submitFindingsToolName,
			Description: "Submit the structured security findings derived from the flow execution",
			Parameters:  findingsReflector.Reflect(&FindingsReport{}),
		},
	}

	resp, err := prv.CallWithTools(ctx, pconfig.OptionsTypeSimple, messages, []llms.Tool{tool}, nil)
	if err != nil {
		return nil, fmt.Errorf("LLM call failed: %w", err)
	}

	args := extractToolArgs(resp, submitFindingsToolName)
	if args == "" {
		return nil, fmt.Errorf("model returned no %s tool call", submitFindingsToolName)
	}
	var report FindingsReport
	if err := json.Unmarshal([]byte(args), &report); err != nil {
		return nil, fmt.Errorf("failed to parse findings JSON: %w", err)
	}
	if len(report.Findings) > maxFindings {
		report.Findings = report.Findings[:maxFindings]
	}
	return &report, nil
}

// buildFindingsContext renders the flow execution into a single clipped human message.
func (pc *providerController) buildFindingsContext(ctx context.Context, flow database.Flow) (string, error) {
	tasks, err := pc.db.GetFlowTasks(ctx, flow.ID)
	if err != nil {
		return "", fmt.Errorf("failed to load tasks: %w", err)
	}
	subtasks, _ := pc.db.GetFlowSubtasks(ctx, flow.ID)
	msglogs, _ := pc.db.GetFlowMsgLogs(ctx, flow.ID)
	termlogs, _ := pc.db.GetFlowTermLogs(ctx, flow.ID)

	subByTask := map[int64][]database.Subtask{}
	for _, s := range subtasks {
		subByTask[s.TaskID] = append(subByTask[s.TaskID], s)
	}
	reportByTask := map[int64]string{}
	for _, m := range msglogs {
		if m.Type == database.MsglogTypeReport && m.TaskID.Valid {
			body := strings.TrimSpace(m.Result)
			if body == "" {
				body = strings.TrimSpace(m.Message)
			}
			if body != "" {
				reportByTask[m.TaskID.Int64] = clip(body, maxReportChars)
			}
		}
	}

	var b strings.Builder
	fmt.Fprintf(&b, "# Flow: %s (id=%d)\n\n", flow.Title, flow.ID)
	for i, t := range tasks {
		if i >= maxDeriveTasks {
			fmt.Fprintf(&b, "\n(... %d more tasks omitted ...)\n", len(tasks)-maxDeriveTasks)
			break
		}
		fmt.Fprintf(&b, "## Task %d: %s\n", t.ID, t.Title)
		if in := clip(t.Input, 300); in != "" {
			fmt.Fprintf(&b, "Input: %s\n", in)
		}
		if res := clip(t.Result, maxTaskResultChars); res != "" {
			fmt.Fprintf(&b, "Result: %s\n", res)
		}
		if rep := reportByTask[t.ID]; rep != "" {
			fmt.Fprintf(&b, "Summary: %s\n", rep)
		}
		for _, s := range subByTask[t.ID] {
			if s.Status != database.SubtaskStatusFinished {
				continue
			}
			if r := clip(firstNonEmpty(s.Result, s.Description), maxSubtaskChars); r != "" {
				fmt.Fprintf(&b, "- %s: %s\n", s.Title, r)
			}
		}
		b.WriteString("\n")
	}

	// Terminal excerpts: richest-first, within a byte budget.
	sort.SliceStable(termlogs, func(i, j int) bool { return len(termlogs[i].Text) > len(termlogs[j].Text) })
	budget := maxTerminalBudget
	if len(termlogs) > 0 && budget > 0 {
		b.WriteString("## Terminal output excerpts\n")
		for _, tl := range termlogs {
			txt := strings.TrimSpace(tl.Text)
			if txt == "" {
				continue
			}
			chunk := clip(txt, 1200)
			if len(chunk) > budget {
				break
			}
			budget -= len(chunk)
			tid := int64(0)
			if tl.TaskID.Valid {
				tid = tl.TaskID.Int64
			}
			fmt.Fprintf(&b, "[task %d] %s\n", tid, chunk)
		}
	}

	out := b.String()
	if len(out) > derivePromptBudget {
		out = out[:derivePromptBudget] + "\n(... truncated ...)"
	}
	return out, nil
}

// extractToolArgs returns the JSON arguments of the first tool call matching name.
func extractToolArgs(resp *llms.ContentResponse, name string) string {
	if resp == nil {
		return ""
	}
	for _, choice := range resp.Choices {
		for _, tc := range choice.ToolCalls {
			if tc.FunctionCall != nil && tc.FunctionCall.Name == name {
				return tc.FunctionCall.Arguments
			}
		}
	}
	// Fallback: a model may emit the JSON as plain content.
	for _, choice := range resp.Choices {
		if s := strings.TrimSpace(choice.Content); strings.HasPrefix(s, "{") {
			return s
		}
	}
	return ""
}

var allowedSeverities = map[string]bool{"critical": true, "high": true, "medium": true, "low": true, "info": true}

func llmFindingToParams(flowID, runID int64, f LLMFinding) database.CreateFindingParams {
	sev := strings.ToLower(strings.TrimSpace(f.Severity))
	if !allowedSeverities[sev] {
		sev = "info"
	}
	prov := f.Provenance
	if prov == nil {
		prov = map[string]string{}
	}
	for _, k := range []string{"severity", "cvss", "cwe"} {
		if prov[k] == "" {
			prov[k] = "inferred"
		}
	}
	return database.CreateFindingParams{
		FlowID:         flowID,
		DeriveRunID:    sql.NullInt64{Int64: runID, Valid: true},
		Title:          clip(firstNonEmpty(f.Title, "Untitled finding"), 300),
		Severity:       sev,
		CvssScore:      toNullFloat(f.CVSSScore),
		CvssVector:     toNullString(f.CVSSVector),
		Cwe:            toNullString(f.CWE),
		Category:       toNullString(f.Category),
		Affected:       jsonOrEmpty(f.Affected, "[]"),
		Description:    f.Description,
		BusinessImpact: toNullString(f.BusinessImpact),
		Likelihood:     toNullInt16(f.Likelihood),
		Impact:         toNullInt16(f.Impact),
		Remediation:    toNullString(f.Remediation),
		References:     jsonOrEmpty(f.References, "[]"),
		Evidence:       toNullString(f.Evidence),
		SourceTaskIds:  jsonOrEmpty(f.SourceTaskIDs, "[]"),
		EvidenceRefs:   json.RawMessage("[]"),
		Provenance:     jsonOrEmpty(prov, "{}"),
	}
}

// ── small helpers ───────────────────────────────────────────────────────────

func clip(s string, max int) string {
	s = strings.TrimSpace(strings.Join(strings.Fields(s), " "))
	if len(s) > max {
		return strings.TrimSpace(s[:max]) + "…"
	}
	return s
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}

func toNullString(s string) sql.NullString {
	if strings.TrimSpace(s) == "" {
		return sql.NullString{}
	}
	return sql.NullString{String: s, Valid: true}
}

func toNullFloat(f float64) sql.NullFloat64 {
	if f <= 0 {
		return sql.NullFloat64{}
	}
	return sql.NullFloat64{Float64: f, Valid: true}
}

func toNullInt16(n int) sql.NullInt16 {
	if n < 1 || n > 5 {
		return sql.NullInt16{}
	}
	return sql.NullInt16{Int16: int16(n), Valid: true}
}

func jsonOrEmpty(v any, fallback string) json.RawMessage {
	b, err := json.Marshal(v)
	if err != nil || len(b) == 0 {
		return json.RawMessage(fallback)
	}
	return json.RawMessage(b)
}
