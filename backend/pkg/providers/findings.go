package providers

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"regexp"
	"sort"
	"strings"
	"time"

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

// Limits keep the prompt within the provider's token budget (DeepSeek output cap raised to
// 8000) and bound how much flow execution is sent, so findings JSON does not get truncated.
const (
	maxDeriveTasks     = 24
	maxFindings        = 12
	maxTaskResultChars = 2000
	maxSubtaskChars    = 900
	maxReportChars     = 2500
	maxTerminalBudget  = 18000
	derivePromptBudget = 55000
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
	AttackPath     []string          `json:"attack_path,omitempty"`
	ReproSteps     []string          `json:"repro_steps,omitempty"`
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

For each finding provide: a concise title that NAMES THE WEAKNESS (e.g. "SQL Injection on /search" or "JWT alg=none authentication bypass" — NOT the agent task name like "run scans"); severity (critical|high|medium|low|info); a COMPLETE CVSS v3.1 vector string (CVSS:3.1/AV:.../AC:.../PR:.../UI:.../S:.../C:.../I:.../A:...) AND its matching base score; the CWE id (e.g. "CWE-89"); a category (e.g. "Web Application", "API", "Network", "Active Directory", "Configuration"); the affected assets (host[:port] or URL) taken ONLY from the execution; a clear description of the weakness and how it was confirmed; the business impact; likelihood and impact each 1-5; concrete remediation; a references list; an attack_path — a 3–5 step kill-chain from recon to impact, each step a short label (e.g. ["Recon","Param q","Injeção boolean/time","Dump do banco"]); repro_steps — concrete numbered reproduction steps a reviewer can follow to confirm the finding; the source_task_ids the finding was derived from; and a provenance map. Keep attack_path and repro_steps grounded ONLY in the execution data — the HONESTY RULES below apply to them too.

TAXONOMY — always classify each finding (these are standard mappings, not inventions):
- Always set the cwe field AND add it to references, e.g. {"label":"CWE-89: SQL Injection"}.
- Always map to OWASP and add it as a reference: web → OWASP Top 10 2021 (e.g. {"label":"OWASP A03:2021 — Injection"}); API → OWASP API Top 10 2023 (e.g. {"label":"OWASP API1:2023 — BOLA"}).
- For network / Active Directory / post-exploitation findings, also add the MITRE ATT&CK technique id as a reference, e.g. {"label":"MITRE ATT&CK T1558.003"}.
- Add a CVE reference ONLY when a specific CVE id is actually present in the execution data; otherwise omit CVE.

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

	// markFailed records the failure on the derivation row so it never stays wedged in
	// 'running' (the cache guard above short-circuits on 'running'/'created').
	markFailed := func(cause error) (database.FindingDerivation, error) {
		upd, uerr := pc.db.UpdateFindingDerivationStatus(ctx, database.UpdateFindingDerivationStatusParams{
			Status: "failed", Summary: sql.NullString{}, Error: toNullString(cause.Error()), ID: run.ID,
		})
		if uerr != nil {
			return run, fmt.Errorf("%w (and status update failed: %v)", cause, uerr)
		}
		return upd, cause
	}

	report, derr := pc.runFindingsLLM(ctx, flow)
	if derr != nil {
		return markFailed(fmt.Errorf("findings derivation failed: %w", derr))
	}

	// Build every row BEFORE any write, then replace the prior findings. On any persist error,
	// drop the partial write so the report falls back cleanly (0 findings -> regex path) instead
	// of showing a half-derived set. (sqlc's Querier interface exposes no tx here; this delete-on-
	// error keeps the table consistent without one.)
	params := make([]database.CreateFindingParams, 0, len(report.Findings))
	for _, f := range report.Findings {
		params = append(params, llmFindingToParams(flowID, run.ID, f))
	}
	if err := pc.db.DeleteFlowFindings(ctx, flowID); err != nil {
		return markFailed(fmt.Errorf("failed to clear previous findings: %w", err))
	}
	for _, p := range params {
		if _, err := pc.db.CreateFinding(ctx, p); err != nil {
			_ = pc.db.DeleteFlowFindings(ctx, flowID) // drop the partial write for a clean fallback
			return markFailed(fmt.Errorf("failed to persist finding: %w", err))
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
	// Bound the (synchronous) LLM call so a provider/network stall fails fast instead of
	// hanging the request goroutine + DB connections indefinitely. Full async is a follow-up.
	ctx, cancel := context.WithTimeout(ctx, 120*time.Second)
	defer cancel()

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
	report, err := parseFindingsReport(args)
	if err != nil {
		return nil, err
	}
	if len(report.Findings) > maxFindings {
		report.Findings = report.Findings[:maxFindings]
	}
	return report, nil
}

// parseFindingsReport tolerantly decodes the model's tool-call arguments. DeepSeek (and other
// providers) frequently return slightly malformed JSON — a trailing '}' or stray text after the
// object, or the whole thing wrapped in a ```json fence. json.Unmarshal rejects ANY trailing
// bytes ("invalid character '}' after top-level value"), which made every derive fail → never
// cached → every export re-ran the ~2-min LLM call. A json.Decoder reads exactly ONE top-level
// value and ignores whatever follows, so these responses parse cleanly.
func parseFindingsReport(args string) (*FindingsReport, error) {
	s := strings.TrimSpace(args)
	// Strip a Markdown code fence if the model wrapped the JSON in one.
	if strings.HasPrefix(s, "```") {
		s = strings.TrimSpace(strings.TrimPrefix(strings.TrimPrefix(strings.TrimPrefix(s, "```"), "json"), "JSON"))
		if i := strings.LastIndex(s, "```"); i >= 0 {
			s = strings.TrimSpace(s[:i])
		}
	}
	// Drop any prose preamble before the first object brace.
	if i := strings.IndexByte(s, '{'); i > 0 {
		s = s[i:]
	}
	var report FindingsReport
	if err := json.NewDecoder(strings.NewReader(s)).Decode(&report); err != nil {
		return nil, fmt.Errorf("failed to parse findings JSON: %w", err)
	}
	return &report, nil
}

// Evidence relevance scoring. The flow's terminal output is mostly noise (dumped JS bundles,
// file listings, base64). Selecting the LONGEST excerpt — what we did before — reliably picked a
// 988 KB minified Angular bundle as "evidence". These heuristics instead favour excerpts that
// actually demonstrate an exploit: HTTP traffic, payloads, credentials, proof-of-impact.
var (
	evidenceSignalRe = regexp.MustCompile(`(?i)(HTTP/[12]|\b(?:GET|POST|PUT|DELETE|PATCH) /|\bcurl\b|Authorization:|\bBearer |Set-Cookie|X-Auth|\bUNION\s+SELECT|SELECT\s.+\sFROM|'\s*OR\s|OR\s+1=1|sqlmap|<script|onerror=|javascript:|\.\./|%2e%2e|alg"?\s*:\s*"?none|eyJ[A-Za-z0-9_-]{8,}|vulnerab|\bpayload|\bbypass|\bexploit|flag\{|\bCVE-\d|\b(?:200|201|301|302|400|401|403|404|500)\b)`)
	evidenceNoiseRe  = regexp.MustCompile(`(=>\s*\{|\}\)\(\)|;var |function\s*\(|\{class |return [a-z]\}|webpackChunk|__webpack|sourceMappingURL)`)
	evidenceB64Re    = regexp.MustCompile(`[A-Za-z0-9+/]{400,}`)
)

// evidenceScore rates how useful a terminal excerpt is as exploit evidence (higher = better).
func evidenceScore(text string) int {
	t := strings.TrimSpace(text)
	n := len(t)
	if n == 0 {
		return 0
	}
	score := len(evidenceSignalRe.FindAllStringIndex(t, 16)) * 6
	score += strings.Count(t, "$ ") + strings.Count(t, "\n# ") // shell prompts = commands run
	score -= len(evidenceNoiseRe.FindAllStringIndex(t, 40)) * 5 // minified JS / bundles
	if evidenceB64Re.MatchString(t) {
		score -= 8
	}
	if spaces := strings.Count(t, " ") + strings.Count(t, "\n"); n > 400 && spaces*40 < n {
		score -= 12 // <2.5% whitespace => minified/binary blob
	}
	switch {
	case n > 20000:
		score -= 15
	case n > 8000:
		score -= 5
	}
	return score
}

// evidenceWindow returns at most max runes centred on the first exploit signal, so even a long log
// surfaces the relevant request/response instead of its (often irrelevant) head.
func evidenceWindow(text string, max int) string {
	t := strings.TrimSpace(text)
	r := []rune(t)
	if len(r) <= max {
		return t
	}
	start := 0
	if loc := evidenceSignalRe.FindStringIndex(t); loc != nil {
		start = len([]rune(t[:loc[0]])) - max/3
		if start < 0 {
			start = 0
		}
	}
	end := start + max
	if end > len(r) {
		end = len(r)
		if start = end - max; start < 0 {
			start = 0
		}
	}
	seg := string(r[start:end])
	if start > 0 {
		seg = "…" + seg
	}
	if end < len(r) {
		seg += "…"
	}
	return seg
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

	// Terminal excerpts: most-RELEVANT-first (not longest), within a byte budget. Score each log
	// for exploit-evidence value and drop pure noise so the budget is spent on real proof.
	type scoredTerm struct {
		text  string
		tid   int64
		score int
	}
	sterms := make([]scoredTerm, 0, len(termlogs))
	for _, tl := range termlogs {
		tid := int64(0)
		if tl.TaskID.Valid {
			tid = tl.TaskID.Int64
		}
		sterms = append(sterms, scoredTerm{text: strings.TrimSpace(tl.Text), tid: tid, score: evidenceScore(tl.Text)})
	}
	sort.SliceStable(sterms, func(i, j int) bool {
		if sterms[i].score != sterms[j].score {
			return sterms[i].score > sterms[j].score
		}
		return len(sterms[i].text) < len(sterms[j].text) // tie: prefer the more concise excerpt
	})
	budget := maxTerminalBudget
	if len(sterms) > 0 && budget > 0 {
		b.WriteString("## Terminal output excerpts\n")
		for _, st := range sterms {
			if st.text == "" || st.score <= 0 {
				continue // skip noise (dumped bundles, listings, base64)
			}
			chunk := evidenceWindow(st.text, 2800)
			if len(chunk) > budget {
				break
			}
			budget -= len(chunk)
			fmt.Fprintf(&b, "[task %d] %s\n", st.tid, chunk)
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
	// Honesty enforcement: the LLM reasons values, it does not measure them — downgrade any
	// 'measured'/'parsed' claim it makes (promotion to 'measured' is a server-side follow-up).
	for k, v := range prov {
		if v == "measured" || v == "parsed" {
			prov[k] = "inferred"
		}
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
		AttackPath:     jsonOrEmpty(f.AttackPath, "[]"),
		ReproSteps:     jsonOrEmpty(f.ReproSteps, "[]"),
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
