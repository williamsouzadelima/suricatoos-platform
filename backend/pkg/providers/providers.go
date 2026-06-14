package providers

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/json"
	"fmt"
	"math"
	"math/big"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"suricatoos/pkg/config"
	"suricatoos/pkg/csum"
	"suricatoos/pkg/database"
	"suricatoos/pkg/docker"
	"suricatoos/pkg/graphiti"
	obs "suricatoos/pkg/observability"
	"suricatoos/pkg/providers/anthropic"
	"suricatoos/pkg/providers/bedrock"
	"suricatoos/pkg/providers/custom"
	"suricatoos/pkg/providers/deepseek"
	"suricatoos/pkg/providers/embeddings"
	"suricatoos/pkg/providers/gemini"
	"suricatoos/pkg/providers/glm"
	"suricatoos/pkg/providers/kimi"
	"suricatoos/pkg/providers/ollama"
	"suricatoos/pkg/providers/openai"
	"suricatoos/pkg/providers/pconfig"
	"suricatoos/pkg/providers/provider"
	"suricatoos/pkg/providers/qwen"
	"suricatoos/pkg/providers/tester"
	"suricatoos/pkg/templates"
	"suricatoos/pkg/tools"

	lru "github.com/hashicorp/golang-lru/v2/expirable"
	"github.com/sirupsen/logrus"
)

const deltaCallCounter = 10000

const defaultTestParallelWorkersNumber = 16

const (
	summarizerCacheMaxSize = 1000
	summarizerCacheTTL     = 4 * time.Hour
)

const pentestDockerImage = "vxcontrol/kali-linux"

type ProviderController interface {
	NewFlowProvider(
		ctx context.Context,
		prvname provider.ProviderName,
		prompter templates.Prompter,
		executor tools.FlowToolsExecutor,
		flowID, userID int64,
		askUser bool,
		input string,
	) (FlowProvider, error)
	LoadFlowProvider(
		ctx context.Context,
		prvname provider.ProviderName,
		prompter templates.Prompter,
		executor tools.FlowToolsExecutor,
		flowID, userID int64,
		askUser bool,
		image, language, title, tcIDTemplate string,
	) (FlowProvider, error)
	NewAssistantProvider(
		ctx context.Context,
		prvname provider.ProviderName,
		prompter templates.Prompter,
		executor tools.FlowToolsExecutor,
		assistantID, flowID, userID int64,
		image, input string,
		streamCb StreamMessageHandler,
	) (AssistantProvider, error)
	LoadAssistantProvider(
		ctx context.Context,
		prvname provider.ProviderName,
		prompter templates.Prompter,
		executor tools.FlowToolsExecutor,
		assistantID, flowID, userID int64,
		image, language, title, tcIDTemplate string,
		streamCb StreamMessageHandler,
	) (AssistantProvider, error)

	Embedder() embeddings.Embedder
	GraphitiClient() *graphiti.Client
	DefaultProviders() provider.Providers
	DefaultProvidersConfig() provider.ProvidersConfig
	GetProvider(
		ctx context.Context,
		prvname provider.ProviderName,
		userID int64,
	) (provider.Provider, error)
	GetProviders(
		ctx context.Context,
		userID int64,
	) (provider.Providers, error)

	// DeriveFindings runs the report-analyst LLM over a finished flow and persists
	// structured findings (idempotent + cached). Used by the report engine.
	DeriveFindings(ctx context.Context, flowID int64) (database.FindingDerivation, error)

	NewProvider(prv database.Provider) (provider.Provider, error)
	CreateProvider(
		ctx context.Context,
		userID int64,
		prvname provider.ProviderName,
		prvtype provider.ProviderType,
		config *pconfig.ProviderConfig,
	) (database.Provider, error)
	UpdateProvider(
		ctx context.Context,
		userID int64,
		prvID int64,
		prvname provider.ProviderName,
		config *pconfig.ProviderConfig,
	) (database.Provider, error)
	DeleteProvider(
		ctx context.Context,
		userID int64,
		prvID int64,
	) (database.Provider, error)

	TestAgent(
		ctx context.Context,
		prvtype provider.ProviderType,
		agentType pconfig.ProviderOptionsType,
		config *pconfig.AgentConfig,
	) (tester.AgentTestResults, error)
	TestProvider(
		ctx context.Context,
		prvtype provider.ProviderType,
		config *pconfig.ProviderConfig,
	) (tester.ProviderTestResults, error)
}

type providerController struct {
	db             database.Querier
	cfg            *config.Config
	docker         docker.DockerClient
	publicIP       string
	dockerNetwork  string
	embedder       embeddings.Embedder
	graphitiClient *graphiti.Client

	startCallNumber *atomic.Int64

	defaultDockerImageForPentest string

	summarizerAgent     csum.Summarizer
	summarizerAssistant csum.Summarizer

	defaultConfigs provider.ProvidersConfig

	provider.Providers
}

func NewProviderController(
	cfg *config.Config,
	db database.Querier,
	docker docker.DockerClient,
) (ProviderController, error) {
	if cfg == nil {
		return nil, fmt.Errorf("config is required")
	}

	embedder, err := embeddings.New(cfg)
	if err != nil {
		logrus.WithError(err).Errorf("failed to create embedder '%s'", cfg.EmbeddingProvider)
	}

	providers := make(provider.Providers)
	defaultConfigs := make(provider.ProvidersConfig)

	if config, err := openai.DefaultProviderConfig(); err != nil {
		return nil, fmt.Errorf("failed to create openai provider config: %w", err)
	} else {
		defaultConfigs[provider.ProviderOpenAI] = config
	}

	if config, err := anthropic.DefaultProviderConfig(); err != nil {
		return nil, fmt.Errorf("failed to create anthropic provider config: %w", err)
	} else {
		defaultConfigs[provider.ProviderAnthropic] = config
	}

	if config, err := gemini.DefaultProviderConfig(); err != nil {
		return nil, fmt.Errorf("failed to create gemini provider config: %w", err)
	} else {
		defaultConfigs[provider.ProviderGemini] = config
	}

	if config, err := bedrock.DefaultProviderConfig(); err != nil {
		return nil, fmt.Errorf("failed to create bedrock provider config: %w", err)
	} else {
		defaultConfigs[provider.ProviderBedrock] = config
	}

	if config, err := ollama.DefaultProviderConfig(cfg); err != nil {
		return nil, fmt.Errorf("failed to create ollama provider config: %w", err)
	} else {
		defaultConfigs[provider.ProviderOllama] = config
	}

	if config, err := custom.DefaultProviderConfig(cfg); err != nil {
		return nil, fmt.Errorf("failed to create custom provider config: %w", err)
	} else {
		defaultConfigs[provider.ProviderCustom] = config
	}

	if config, err := deepseek.DefaultProviderConfig(); err != nil {
		return nil, fmt.Errorf("failed to create deepseek provider config: %w", err)
	} else {
		defaultConfigs[provider.ProviderDeepSeek] = config
	}

	if config, err := glm.DefaultProviderConfig(); err != nil {
		return nil, fmt.Errorf("failed to create glm provider config: %w", err)
	} else {
		defaultConfigs[provider.ProviderGLM] = config
	}

	if config, err := kimi.DefaultProviderConfig(); err != nil {
		return nil, fmt.Errorf("failed to create kimi provider config: %w", err)
	} else {
		defaultConfigs[provider.ProviderKimi] = config
	}

	if config, err := qwen.DefaultProviderConfig(); err != nil {
		return nil, fmt.Errorf("failed to create qwen provider config: %w", err)
	} else {
		defaultConfigs[provider.ProviderQwen] = config
	}

	if cfg.OpenAIKey != "" {
		p, err := openai.New(cfg, provider.DefaultProviderNameOpenAI, defaultConfigs[provider.ProviderOpenAI])
		if err != nil {
			return nil, fmt.Errorf("failed to create openai provider: %w", err)
		}

		providers[provider.DefaultProviderNameOpenAI] = p
	}

	if cfg.AnthropicAPIKey != "" {
		p, err := anthropic.New(cfg, provider.DefaultProviderNameAnthropic, defaultConfigs[provider.ProviderAnthropic])
		if err != nil {
			return nil, fmt.Errorf("failed to create anthropic provider: %w", err)
		}

		providers[provider.DefaultProviderNameAnthropic] = p
	}

	if cfg.GeminiAPIKey != "" {
		p, err := gemini.New(cfg, provider.DefaultProviderNameGemini, defaultConfigs[provider.ProviderGemini])
		if err != nil {
			return nil, fmt.Errorf("failed to create gemini provider: %w", err)
		}

		providers[provider.DefaultProviderNameGemini] = p
	}

	// Bedrock supports three authentication strategies:
	// 1. Default AWS SDK auth (BedrockDefaultAuth=true)
	// 2. Bearer token (BedrockBearerToken set)
	// 3. Static credentials (BedrockAccessKey + BedrockSecretKey)
	if cfg.BedrockDefaultAuth || cfg.BedrockBearerToken != "" ||
		(cfg.BedrockAccessKey != "" && cfg.BedrockSecretKey != "") {
		p, err := bedrock.New(cfg, provider.DefaultProviderNameBedrock, defaultConfigs[provider.ProviderBedrock])
		if err != nil {
			return nil, fmt.Errorf("failed to create bedrock provider: %w", err)
		}
		providers[provider.DefaultProviderNameBedrock] = p
	}

	if cfg.OllamaServerURL != "" {
		p, err := ollama.New(cfg, provider.DefaultProviderNameOllama, defaultConfigs[provider.ProviderOllama])
		if err != nil {
			return nil, fmt.Errorf("failed to create ollama provider: %w", err)
		}
		providers[provider.DefaultProviderNameOllama] = p
	}

	if cfg.LLMServerURL != "" && (cfg.LLMServerModel != "" || cfg.LLMServerConfig != "") {
		p, err := custom.New(cfg, provider.DefaultProviderNameCustom, defaultConfigs[provider.ProviderCustom])
		if err != nil {
			return nil, fmt.Errorf("failed to create custom provider: %w", err)
		}

		providers[provider.DefaultProviderNameCustom] = p
	}

	if cfg.DeepSeekAPIKey != "" {
		p, err := deepseek.New(cfg, provider.DefaultProviderNameDeepSeek, defaultConfigs[provider.ProviderDeepSeek])
		if err != nil {
			return nil, fmt.Errorf("failed to create deepseek provider: %w", err)
		}

		providers[provider.DefaultProviderNameDeepSeek] = p
	}

	if cfg.GLMAPIKey != "" {
		p, err := glm.New(cfg, provider.DefaultProviderNameGLM, defaultConfigs[provider.ProviderGLM])
		if err != nil {
			return nil, fmt.Errorf("failed to create glm provider: %w", err)
		}

		providers[provider.DefaultProviderNameGLM] = p
	}

	if cfg.KimiAPIKey != "" {
		p, err := kimi.New(cfg, provider.DefaultProviderNameKimi, defaultConfigs[provider.ProviderKimi])
		if err != nil {
			return nil, fmt.Errorf("failed to create kimi provider: %w", err)
		}

		providers[provider.DefaultProviderNameKimi] = p
	}

	if cfg.QwenAPIKey != "" {
		p, err := qwen.New(cfg, provider.DefaultProviderNameQwen, defaultConfigs[provider.ProviderQwen])
		if err != nil {
			return nil, fmt.Errorf("failed to create qwen provider: %w", err)
		}

		providers[provider.DefaultProviderNameQwen] = p
	}

	summarizerAgent := csum.NewSummarizer(csum.SummarizerConfig{
		PreserveLast:   cfg.SummarizerPreserveLast,
		UseQA:          cfg.SummarizerUseQA,
		SummHumanInQA:  cfg.SummarizerSumHumanInQA,
		LastSecBytes:   cfg.SummarizerLastSecBytes,
		MaxBPBytes:     cfg.SummarizerMaxBPBytes,
		MaxQASections:  cfg.SummarizerMaxQASections,
		MaxQABytes:     cfg.SummarizerMaxQABytes,
		KeepQASections: cfg.SummarizerKeepQASections,
	})

	summarizerAssistant := csum.NewSummarizer(csum.SummarizerConfig{
		PreserveLast:   cfg.AssistantSummarizerPreserveLast,
		UseQA:          true,
		SummHumanInQA:  false,
		LastSecBytes:   cfg.AssistantSummarizerLastSecBytes,
		MaxBPBytes:     cfg.AssistantSummarizerMaxBPBytes,
		MaxQASections:  cfg.AssistantSummarizerMaxQASections,
		MaxQABytes:     cfg.AssistantSummarizerMaxQABytes,
		KeepQASections: cfg.AssistantSummarizerKeepQASections,
	})

	graphitiClient, err := graphiti.NewClient(
		cfg.GraphitiURL,
		time.Duration(cfg.GraphitiTimeout)*time.Second,
		cfg.GraphitiEnabled && cfg.GraphitiURL != "",
	)
	if err != nil {
		logrus.WithError(err).Warn("failed to initialize graphiti client, continuing without it")
		graphitiClient = &graphiti.Client{}
	}

	return &providerController{
		db:             db,
		cfg:            cfg,
		docker:         docker,
		publicIP:       cfg.DockerPublicIP,
		dockerNetwork:  cfg.DockerNetwork,
		embedder:       embedder,
		graphitiClient: graphitiClient,

		startCallNumber: newAtomicInt64(0), // 0 means to make it random

		defaultDockerImageForPentest: cfg.DockerDefaultImageForPentest,

		summarizerAgent:     summarizerAgent,
		summarizerAssistant: summarizerAssistant,

		defaultConfigs: defaultConfigs,

		Providers: providers,
	}, nil
}

func (pc *providerController) NewFlowProvider(
	ctx context.Context,
	prvname provider.ProviderName,
	prompter templates.Prompter,
	executor tools.FlowToolsExecutor,
	flowID, userID int64,
	askUser bool,
	input string,
) (FlowProvider, error) {
	ctx, span := obs.Observer.NewSpan(ctx, obs.SpanKindInternal, "providers.NewFlowProvider")
	defer span.End()

	prv, err := pc.GetProvider(ctx, prvname, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get provider: %w", err)
	}

	imageTmpl, err := prompter.RenderTemplate(templates.PromptTypeImageChooser, map[string]any{
		"DefaultImage":           pc.docker.GetDefaultImage(),
		"DefaultImageForPentest": pc.defaultDockerImageForPentest,
		"Input":                  input,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get primary docker image template: %w", err)
	}

	image, err := prv.Call(ctx, pconfig.OptionsTypeSimple, imageTmpl)
	if err != nil {
		return nil, fmt.Errorf("failed to select primary docker image via llm call: %w", err)
	}
	image = strings.ToLower(strings.TrimSpace(image))

	languageTmpl, err := prompter.RenderTemplate(templates.PromptTypeLanguageChooser, map[string]any{
		"Input": input,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get language template: %w", err)
	}

	language, err := prv.Call(ctx, pconfig.OptionsTypeSimple, languageTmpl)
	if err != nil {
		return nil, fmt.Errorf("failed to get language: %w", err)
	}
	language = strings.TrimSpace(language)

	titleTmpl, err := prompter.RenderTemplate(templates.PromptTypeFlowDescriptor, map[string]any{
		"Input":       input,
		"Lang":        language,
		"CurrentTime": getCurrentTime(),
		"N":           20,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get flow title template: %w", err)
	}

	title, err := prv.Call(ctx, pconfig.OptionsTypeSimple, titleTmpl)
	if err != nil {
		return nil, fmt.Errorf("failed to get flow title: %w", err)
	}
	title = strings.TrimSpace(title)

	tcIDTemplate, err := prv.GetToolCallIDTemplate(ctx, prompter)
	if err != nil {
		return nil, wrapToolCallIDTemplateError(err)
	}

	fp := &flowProvider{
		db:              pc.db,
		mx:              &sync.RWMutex{},
		embedder:        pc.embedder,
		graphitiClient:  pc.graphitiClient,
		flowID:          flowID,
		dataDir:         pc.cfg.DataDir,
		publicIP:        pc.publicIP,
		dockerNetwork:   pc.dockerNetwork,
		callCounter:     newAtomicInt64(pc.startCallNumber.Add(deltaCallCounter)),
		image:           image,
		title:           title,
		language:        language,
		askUser:         askUser,
		planning:        pc.cfg.AgentPlanningStepEnabled,
		tcIDTemplate:    tcIDTemplate,
		prompter:        prompter,
		executor:        executor,
		summarizer:      pc.summarizerAgent,
		summarizerCache: lru.NewLRU[[32]byte, string](summarizerCacheMaxSize, nil, summarizerCacheTTL),
		Provider:        prv,
		maxGACallsLimit: pc.cfg.MaxGeneralAgentToolCalls,
		maxLACallsLimit: pc.cfg.MaxLimitedAgentToolCalls,
		buildMonitor: func() *executionMonitor {
			return &executionMonitor{
				enabled:        pc.cfg.ExecutionMonitorEnabled,
				sameThreshold:  pc.cfg.ExecutionMonitorSameToolLimit,
				totalThreshold: pc.cfg.ExecutionMonitorTotalToolLimit,
			}
		},
	}

	return fp, nil
}

func (pc *providerController) LoadFlowProvider(
	ctx context.Context,
	prvname provider.ProviderName,
	prompter templates.Prompter,
	executor tools.FlowToolsExecutor,
	flowID, userID int64,
	askUser bool,
	image, language, title, tcIDTemplate string,
) (FlowProvider, error) {
	ctx, span := obs.Observer.NewSpan(ctx, obs.SpanKindInternal, "providers.LoadFlowProvider")
	defer span.End()

	prv, err := pc.GetProvider(ctx, prvname, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get provider: %w", err)
	}

	fp := &flowProvider{
		db:              pc.db,
		mx:              &sync.RWMutex{},
		embedder:        pc.embedder,
		graphitiClient:  pc.graphitiClient,
		flowID:          flowID,
		dataDir:         pc.cfg.DataDir,
		publicIP:        pc.publicIP,
		dockerNetwork:   pc.dockerNetwork,
		callCounter:     newAtomicInt64(pc.startCallNumber.Add(deltaCallCounter)),
		image:           image,
		title:           title,
		language:        language,
		askUser:         askUser,
		planning:        pc.cfg.AgentPlanningStepEnabled,
		tcIDTemplate:    tcIDTemplate,
		prompter:        prompter,
		executor:        executor,
		summarizer:      pc.summarizerAgent,
		summarizerCache: lru.NewLRU[[32]byte, string](summarizerCacheMaxSize, nil, summarizerCacheTTL),
		Provider:        prv,
		maxGACallsLimit: pc.cfg.MaxGeneralAgentToolCalls,
		maxLACallsLimit: pc.cfg.MaxLimitedAgentToolCalls,
		buildMonitor: func() *executionMonitor {
			return &executionMonitor{
				enabled:        pc.cfg.ExecutionMonitorEnabled,
				sameThreshold:  pc.cfg.ExecutionMonitorSameToolLimit,
				totalThreshold: pc.cfg.ExecutionMonitorTotalToolLimit,
			}
		},
	}

	return fp, nil
}

func (pc *providerController) Embedder() embeddings.Embedder {
	return pc.embedder
}

func (pc *providerController) GraphitiClient() *graphiti.Client {
	return pc.graphitiClient
}

func (pc *providerController) NewAssistantProvider(
	ctx context.Context,
	prvname provider.ProviderName,
	prompter templates.Prompter,
	executor tools.FlowToolsExecutor,
	assistantID, flowID, userID int64,
	image, input string,
	streamCb StreamMessageHandler,
) (AssistantProvider, error) {
	ctx, span := obs.Observer.NewSpan(ctx, obs.SpanKindInternal, "providers.NewAssistantProvider")
	defer span.End()

	prv, err := pc.GetProvider(ctx, prvname, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get provider: %w", err)
	}

	languageTmpl, err := prompter.RenderTemplate(templates.PromptTypeLanguageChooser, map[string]any{
		"Input": input,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get language template: %w", err)
	}

	language, err := prv.Call(ctx, pconfig.OptionsTypeSimple, languageTmpl)
	if err != nil {
		return nil, fmt.Errorf("failed to get language: %w", err)
	}
	language = strings.TrimSpace(language)

	titleTmpl, err := prompter.RenderTemplate(templates.PromptTypeFlowDescriptor, map[string]any{
		"Input":       input,
		"Lang":        language,
		"CurrentTime": getCurrentTime(),
		"N":           20,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get flow title template: %w", err)
	}

	title, err := prv.Call(ctx, pconfig.OptionsTypeSimple, titleTmpl)
	if err != nil {
		return nil, fmt.Errorf("failed to get flow title: %w", err)
	}
	title = strings.TrimSpace(title)

	tcIDTemplate, err := prv.GetToolCallIDTemplate(ctx, prompter)
	if err != nil {
		return nil, wrapToolCallIDTemplateError(err)
	}

	ap := &assistantProvider{
		id:         assistantID,
		summarizer: pc.summarizerAssistant,
		fp: flowProvider{
			db:              pc.db,
			mx:              &sync.RWMutex{},
			embedder:        pc.embedder,
			graphitiClient:  pc.graphitiClient,
			flowID:          flowID,
			dataDir:         pc.cfg.DataDir,
			publicIP:        pc.publicIP,
			dockerNetwork:   pc.dockerNetwork,
			callCounter:     newAtomicInt64(pc.startCallNumber.Add(deltaCallCounter)),
			image:           image,
			title:           title,
			language:        language,
			tcIDTemplate:    tcIDTemplate,
			prompter:        prompter,
			executor:        executor,
			streamCb:        streamCb,
			summarizer:      pc.summarizerAgent,
			summarizerCache: lru.NewLRU[[32]byte, string](summarizerCacheMaxSize, nil, summarizerCacheTTL),
			Provider:        prv,
			maxGACallsLimit: pc.cfg.MaxGeneralAgentToolCalls,
			maxLACallsLimit: pc.cfg.MaxLimitedAgentToolCalls,
			buildMonitor: func() *executionMonitor {
				return &executionMonitor{
					enabled:        pc.cfg.ExecutionMonitorEnabled,
					sameThreshold:  pc.cfg.ExecutionMonitorSameToolLimit,
					totalThreshold: pc.cfg.ExecutionMonitorTotalToolLimit,
				}
			},
		},
	}

	return ap, nil
}

func (pc *providerController) LoadAssistantProvider(
	ctx context.Context,
	prvname provider.ProviderName,
	prompter templates.Prompter,
	executor tools.FlowToolsExecutor,
	assistantID, flowID, userID int64,
	image, language, title, tcIDTemplate string,
	streamCb StreamMessageHandler,
) (AssistantProvider, error) {
	ctx, span := obs.Observer.NewSpan(ctx, obs.SpanKindInternal, "providers.LoadAssistantProvider")
	defer span.End()

	prv, err := pc.GetProvider(ctx, prvname, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get provider: %w", err)
	}

	ap := &assistantProvider{
		id:         assistantID,
		summarizer: pc.summarizerAssistant,
		fp: flowProvider{
			db:              pc.db,
			mx:              &sync.RWMutex{},
			embedder:        pc.embedder,
			graphitiClient:  pc.graphitiClient,
			flowID:          flowID,
			dataDir:         pc.cfg.DataDir,
			publicIP:        pc.publicIP,
			dockerNetwork:   pc.dockerNetwork,
			callCounter:     newAtomicInt64(pc.startCallNumber.Add(deltaCallCounter)),
			image:           image,
			title:           title,
			language:        language,
			tcIDTemplate:    tcIDTemplate,
			prompter:        prompter,
			executor:        executor,
			streamCb:        streamCb,
			summarizer:      pc.summarizerAgent,
			summarizerCache: lru.NewLRU[[32]byte, string](summarizerCacheMaxSize, nil, summarizerCacheTTL),
			Provider:        prv,
			maxGACallsLimit: pc.cfg.MaxGeneralAgentToolCalls,
			maxLACallsLimit: pc.cfg.MaxLimitedAgentToolCalls,
			buildMonitor: func() *executionMonitor {
				return &executionMonitor{
					enabled:        pc.cfg.ExecutionMonitorEnabled,
					sameThreshold:  pc.cfg.ExecutionMonitorSameToolLimit,
					totalThreshold: pc.cfg.ExecutionMonitorTotalToolLimit,
				}
			},
		},
	}

	return ap, nil
}

func (pc *providerController) DefaultProviders() provider.Providers {
	return pc.Providers
}

func (pc *providerController) DefaultProvidersConfig() provider.ProvidersConfig {
	return pc.defaultConfigs
}

func (pc *providerController) GetProvider(
	ctx context.Context,
	prvname provider.ProviderName,
	userID int64,
) (provider.Provider, error) {
	// Lookup user defined providers first so they take precedence over built-in providers
	prv, err := pc.db.GetUserProviderByName(ctx, database.GetUserProviderByNameParams{
		Name:   string(prvname),
		UserID: userID,
	})
	if err != nil && err != sql.ErrNoRows {
		return nil, fmt.Errorf("failed to get provider '%s' from database: %w", prvname, err)
	}
	if err == nil {
		return pc.NewProvider(prv)
	}

	// Fall back to built-in default providers
	switch prvname {
	case provider.DefaultProviderNameOpenAI:
		return pc.Providers.Get(provider.DefaultProviderNameOpenAI)
	case provider.DefaultProviderNameAnthropic:
		return pc.Providers.Get(provider.DefaultProviderNameAnthropic)
	case provider.DefaultProviderNameGemini:
		return pc.Providers.Get(provider.DefaultProviderNameGemini)
	case provider.DefaultProviderNameBedrock:
		return pc.Providers.Get(provider.DefaultProviderNameBedrock)
	case provider.DefaultProviderNameOllama:
		return pc.Providers.Get(provider.DefaultProviderNameOllama)
	case provider.DefaultProviderNameCustom:
		return pc.Providers.Get(provider.DefaultProviderNameCustom)
	case provider.DefaultProviderNameDeepSeek:
		return pc.Providers.Get(provider.DefaultProviderNameDeepSeek)
	case provider.DefaultProviderNameGLM:
		return pc.Providers.Get(provider.DefaultProviderNameGLM)
	case provider.DefaultProviderNameKimi:
		return pc.Providers.Get(provider.DefaultProviderNameKimi)
	case provider.DefaultProviderNameQwen:
		return pc.Providers.Get(provider.DefaultProviderNameQwen)
	}

	return nil, fmt.Errorf("provider '%s' not found", prvname)
}

func (pc *providerController) GetProviders(
	ctx context.Context,
	userID int64,
) (provider.Providers, error) {
	providersMap := make(provider.Providers, len(pc.Providers))

	// Copy default providers
	for prvname, prv := range pc.Providers {
		providersMap[prvname] = prv
	}

	// Copy user providers
	providers, err := pc.db.GetUserProviders(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user providers: %w", err)
	}

	for _, prv := range providers {
		p, err := pc.NewProvider(prv)
		if err != nil {
			return nil, fmt.Errorf("failed to build provider: %w", err)
		}
		providersMap[provider.ProviderName(prv.Name)] = p
	}

	return providersMap, nil
}

func (pc *providerController) NewProvider(prv database.Provider) (provider.Provider, error) {
	if len(prv.Config) == 0 {
		prv.Config = []byte(pconfig.EmptyProviderConfigRaw)
	}

	// A user-defined provider is valid for ANY supported type: it carries its own
	// credentials (api_key / base_url) entered via the UI, so it does not require the
	// matching env-based default provider to exist. Genuinely unknown types are still
	// rejected by the switch's default case below.
	providerName := provider.ProviderName(prv.Name)
	providerType := provider.ProviderType(prv.Type)

	// Resolve provider-level credentials entered via the UI onto a per-call config
	// copy: the decrypted API key / base URL override the env defaults; when empty,
	// the env config is used unchanged. The copy never mutates the shared config.
	resolvedCfg := pc.cfg
	var uiCreds struct {
		APIKey  string `json:"api_key"`
		BaseURL string `json:"base_url"`
	}
	if jerr := json.Unmarshal(prv.Config, &uiCreds); jerr == nil && (uiCreds.APIKey != "" || uiCreds.BaseURL != "") {
		apiKey, derr := pconfig.DecryptSecret(uiCreds.APIKey, pc.cfg.CookieSigningSalt)
		if derr != nil {
			return nil, fmt.Errorf("failed to decrypt provider credentials: %w", derr)
		}
		cfgCopy := applyProviderCredentials(*pc.cfg, providerType, apiKey, uiCreds.BaseURL)
		resolvedCfg = &cfgCopy
	}

	switch providerType {
	case provider.ProviderOpenAI:
		openaiConfig, err := openai.BuildProviderConfig(prv.Config)
		if err != nil {
			return nil, fmt.Errorf("failed to build openai provider config: %w", err)
		}
		return openai.New(resolvedCfg, providerName, openaiConfig)
	case provider.ProviderAnthropic:
		anthropicConfig, err := anthropic.BuildProviderConfig(prv.Config)
		if err != nil {
			return nil, fmt.Errorf("failed to build anthropic provider config: %w", err)
		}
		return anthropic.New(resolvedCfg, providerName, anthropicConfig)
	case provider.ProviderGemini:
		geminiConfig, err := gemini.BuildProviderConfig(prv.Config)
		if err != nil {
			return nil, fmt.Errorf("failed to build gemini provider config: %w", err)
		}
		return gemini.New(resolvedCfg, providerName, geminiConfig)
	case provider.ProviderBedrock:
		bedrockConfig, err := bedrock.BuildProviderConfig(prv.Config)
		if err != nil {
			return nil, fmt.Errorf("failed to build bedrock provider config: %w", err)
		}
		return bedrock.New(resolvedCfg, providerName, bedrockConfig)
	case provider.ProviderOllama:
		ollamaConfig, err := ollama.BuildProviderConfig(resolvedCfg, prv.Config)
		if err != nil {
			return nil, fmt.Errorf("failed to build ollama provider config: %w", err)
		}
		return ollama.New(resolvedCfg, providerName, ollamaConfig)
	case provider.ProviderCustom:
		customConfig, err := custom.BuildProviderConfig(resolvedCfg, prv.Config)
		if err != nil {
			return nil, fmt.Errorf("failed to build custom provider config: %w", err)
		}
		return custom.New(resolvedCfg, providerName, customConfig)
	case provider.ProviderDeepSeek:
		deepseekConfig, err := deepseek.BuildProviderConfig(prv.Config)
		if err != nil {
			return nil, fmt.Errorf("failed to build deepseek provider config: %w", err)
		}
		return deepseek.New(resolvedCfg, providerName, deepseekConfig)
	case provider.ProviderGLM:
		glmConfig, err := glm.BuildProviderConfig(prv.Config)
		if err != nil {
			return nil, fmt.Errorf("failed to build glm provider config: %w", err)
		}
		return glm.New(resolvedCfg, providerName, glmConfig)
	case provider.ProviderKimi:
		kimiConfig, err := kimi.BuildProviderConfig(prv.Config)
		if err != nil {
			return nil, fmt.Errorf("failed to build kimi provider config: %w", err)
		}
		return kimi.New(resolvedCfg, providerName, kimiConfig)
	case provider.ProviderQwen:
		qwenConfig, err := qwen.BuildProviderConfig(prv.Config)
		if err != nil {
			return nil, fmt.Errorf("failed to build qwen provider config: %w", err)
		}
		return qwen.New(resolvedCfg, providerName, qwenConfig)
	default:
		return nil, fmt.Errorf("unknown provider type: %s", prv.Type)
	}
}

// applyProviderCredentials returns a copy of cfg with the per-provider API key
// and base URL (entered via the UI) overlaid onto the matching env-based fields.
// Empty overrides leave the env defaults intact.
func applyProviderCredentials(cfg config.Config, ptype provider.ProviderType, apiKey, baseURL string) config.Config {
	set := func(dst *string, v string) {
		if v != "" {
			*dst = v
		}
	}
	switch ptype {
	case provider.ProviderOpenAI:
		set(&cfg.OpenAIKey, apiKey)
		set(&cfg.OpenAIServerURL, baseURL)
	case provider.ProviderAnthropic:
		set(&cfg.AnthropicAPIKey, apiKey)
		set(&cfg.AnthropicServerURL, baseURL)
	case provider.ProviderGemini:
		set(&cfg.GeminiAPIKey, apiKey)
		set(&cfg.GeminiServerURL, baseURL)
	case provider.ProviderBedrock:
		set(&cfg.BedrockBearerToken, apiKey)
		set(&cfg.BedrockServerURL, baseURL)
	case provider.ProviderOllama:
		set(&cfg.OllamaServerAPIKey, apiKey)
		set(&cfg.OllamaServerURL, baseURL)
	case provider.ProviderCustom:
		set(&cfg.LLMServerKey, apiKey)
		set(&cfg.LLMServerURL, baseURL)
	case provider.ProviderDeepSeek:
		set(&cfg.DeepSeekAPIKey, apiKey)
		set(&cfg.DeepSeekServerURL, baseURL)
	case provider.ProviderGLM:
		set(&cfg.GLMAPIKey, apiKey)
		set(&cfg.GLMServerURL, baseURL)
	case provider.ProviderKimi:
		set(&cfg.KimiAPIKey, apiKey)
		set(&cfg.KimiServerURL, baseURL)
	case provider.ProviderQwen:
		set(&cfg.QwenAPIKey, apiKey)
		set(&cfg.QwenServerURL, baseURL)
	}
	return cfg
}

func (pc *providerController) CreateProvider(
	ctx context.Context,
	userID int64,
	prvname provider.ProviderName,
	prvtype provider.ProviderType,
	config *pconfig.ProviderConfig,
) (database.Provider, error) {
	ctx, span := obs.Observer.NewSpan(ctx, obs.SpanKindInternal, "providers.CreateProvider")
	defer span.End()

	var (
		err    error
		result database.Provider
	)

	if config, err = pc.patchProviderConfig(prvtype, config); err != nil {
		return result, fmt.Errorf("failed to patch provider config: %w", err)
	}

	// Encrypt the UI-provided API key before it touches the database.
	if config.APIKey, err = pconfig.EncryptSecret(config.APIKey, pc.cfg.CookieSigningSalt); err != nil {
		return result, fmt.Errorf("failed to encrypt provider api key: %w", err)
	}

	rawConfig, err := json.Marshal(config)
	if err != nil {
		return result, fmt.Errorf("failed to marshal provider config: %w", err)
	}

	result, err = pc.db.CreateProvider(ctx, database.CreateProviderParams{
		UserID: userID,
		Type:   database.ProviderType(prvtype),
		Name:   string(prvname),
		Config: rawConfig,
	})
	if err != nil {
		return result, fmt.Errorf("failed to create provider: %w", err)
	}

	return result, nil
}

func (pc *providerController) UpdateProvider(
	ctx context.Context,
	userID int64,
	prvID int64,
	prvname provider.ProviderName,
	config *pconfig.ProviderConfig,
) (database.Provider, error) {
	ctx, span := obs.Observer.NewSpan(ctx, obs.SpanKindInternal, "providers.UpdateProvider")
	defer span.End()

	var (
		err    error
		result database.Provider
	)

	prv, err := pc.db.GetUserProvider(ctx, database.GetUserProviderParams{
		ID:     prvID,
		UserID: userID,
	})
	if err != nil {
		return result, fmt.Errorf("failed to get provider: %w", err)
	}
	prvtype := provider.ProviderType(prv.Type)

	if config, err = pc.patchProviderConfig(prvtype, config); err != nil {
		return result, fmt.Errorf("failed to patch provider config: %w", err)
	}

	// Preserve the stored (encrypted) API key when the update omits it; otherwise
	// encrypt the newly provided key before persisting.
	if config.APIKey == "" {
		var existing struct {
			APIKey string `json:"api_key"`
		}
		_ = json.Unmarshal(prv.Config, &existing)
		config.APIKey = existing.APIKey
	} else if config.APIKey, err = pconfig.EncryptSecret(config.APIKey, pc.cfg.CookieSigningSalt); err != nil {
		return result, fmt.Errorf("failed to encrypt provider api key: %w", err)
	}

	rawConfig, err := json.Marshal(config)
	if err != nil {
		return result, fmt.Errorf("failed to marshal provider config: %w", err)
	}

	result, err = pc.db.UpdateUserProvider(ctx, database.UpdateUserProviderParams{
		ID:     prvID,
		UserID: userID,
		Name:   string(prvname),
		Config: rawConfig,
	})
	if err != nil {
		return result, fmt.Errorf("failed to update provider: %w", err)
	}

	return result, nil
}

func (pc *providerController) DeleteProvider(
	ctx context.Context,
	userID int64,
	prvID int64,
) (database.Provider, error) {
	ctx, span := obs.Observer.NewSpan(ctx, obs.SpanKindInternal, "providers.DeleteProvider")
	defer span.End()

	result, err := pc.db.DeleteUserProvider(ctx, database.DeleteUserProviderParams{
		ID:     prvID,
		UserID: userID,
	})
	if err != nil {
		return result, fmt.Errorf("failed to delete provider: %w", err)
	}

	return result, nil
}

func (pc *providerController) TestAgent(
	ctx context.Context,
	prvtype provider.ProviderType,
	agentType pconfig.ProviderOptionsType,
	config *pconfig.AgentConfig,
) (tester.AgentTestResults, error) {
	ctx, span := obs.Observer.NewSpan(ctx, obs.SpanKindInternal, "providers.TestAgent")
	defer span.End()

	var result tester.AgentTestResults

	// Create provider config with single agent configuration
	testConfig := &pconfig.ProviderConfig{}

	// Set the agent config to the appropriate field based on agent type
	switch agentType {
	case pconfig.OptionsTypeSimple:
		testConfig.Simple = config
	case pconfig.OptionsTypeSimpleJSON:
		testConfig.SimpleJSON = config
	case pconfig.OptionsTypePrimaryAgent:
		testConfig.PrimaryAgent = config
	case pconfig.OptionsTypeAssistant:
		testConfig.Assistant = config
	case pconfig.OptionsTypeGenerator:
		testConfig.Generator = config
	case pconfig.OptionsTypeRefiner:
		testConfig.Refiner = config
	case pconfig.OptionsTypeAdviser:
		testConfig.Adviser = config
	case pconfig.OptionsTypeReflector:
		testConfig.Reflector = config
	case pconfig.OptionsTypeSearcher:
		testConfig.Searcher = config
	case pconfig.OptionsTypeEnricher:
		testConfig.Enricher = config
	case pconfig.OptionsTypeCoder:
		testConfig.Coder = config
	case pconfig.OptionsTypeInstaller:
		testConfig.Installer = config
	case pconfig.OptionsTypePentester:
		testConfig.Pentester = config
	default:
		return result, fmt.Errorf("unsupported agent type: %s", agentType)
	}

	// Patch with defaults
	patchedConfig, err := pc.patchProviderConfig(prvtype, testConfig)
	if err != nil {
		return result, fmt.Errorf("failed to patch provider config: %w", err)
	}

	// Create temporary provider for testing using existing provider logic
	providerName := provider.ProviderName("test-provider")
	tempProvider, err := pc.buildProviderFromConfig(prvtype, providerName, patchedConfig)
	if err != nil {
		return result, fmt.Errorf("failed to create provider for testing: %w", err)
	}

	// Run tests for specific agent type only
	results, err := tester.TestProvider(
		ctx,
		tempProvider,
		tester.WithAgentTypes(agentType),
		tester.WithVerbose(false),
		tester.WithParallelWorkers(defaultTestParallelWorkersNumber),
	)
	if err != nil {
		return result, fmt.Errorf("failed to test agent: %w", err)
	}

	// Extract results for the specific agent type
	switch agentType {
	case pconfig.OptionsTypeSimple:
		result = results.Simple
	case pconfig.OptionsTypeSimpleJSON:
		result = results.SimpleJSON
	case pconfig.OptionsTypePrimaryAgent:
		result = results.PrimaryAgent
	case pconfig.OptionsTypeAssistant:
		result = results.Assistant
	case pconfig.OptionsTypeGenerator:
		result = results.Generator
	case pconfig.OptionsTypeRefiner:
		result = results.Refiner
	case pconfig.OptionsTypeAdviser:
		result = results.Adviser
	case pconfig.OptionsTypeReflector:
		result = results.Reflector
	case pconfig.OptionsTypeSearcher:
		result = results.Searcher
	case pconfig.OptionsTypeEnricher:
		result = results.Enricher
	case pconfig.OptionsTypeCoder:
		result = results.Coder
	case pconfig.OptionsTypeInstaller:
		result = results.Installer
	case pconfig.OptionsTypePentester:
		result = results.Pentester
	default:
		return result, fmt.Errorf("unexpected agent type: %s", agentType)
	}

	return result, nil
}

func (pc *providerController) TestProvider(
	ctx context.Context,
	prvtype provider.ProviderType,
	config *pconfig.ProviderConfig,
) (tester.ProviderTestResults, error) {
	ctx, span := obs.Observer.NewSpan(ctx, obs.SpanKindInternal, "providers.TestProvider")
	defer span.End()

	var results tester.ProviderTestResults

	// Patch config with defaults
	patchedConfig, err := pc.patchProviderConfig(prvtype, config)
	if err != nil {
		return results, fmt.Errorf("failed to patch provider config: %w", err)
	}

	// Create provider for testing
	providerName := provider.ProviderName("test-provider")
	testProvider, err := pc.buildProviderFromConfig(prvtype, providerName, patchedConfig)
	if err != nil {
		return results, fmt.Errorf("failed to create provider for testing: %w", err)
	}

	// Run full provider testing
	results, err = tester.TestProvider(
		ctx,
		testProvider,
		tester.WithVerbose(false),
		tester.WithParallelWorkers(defaultTestParallelWorkersNumber),
	)
	if err != nil {
		return results, fmt.Errorf("failed to test provider: %w", err)
	}

	return results, nil
}

func (pc *providerController) patchProviderConfig(
	prvtype provider.ProviderType,
	config *pconfig.ProviderConfig,
) (*pconfig.ProviderConfig, error) {
	var (
		defaultCfg *pconfig.ProviderConfig
		ok         bool
	)

	if defaultCfg, ok = pc.defaultConfigs[prvtype]; !ok {
		return nil, fmt.Errorf("default provider config not found for type: %s", prvtype.String())
	}

	if config == nil {
		return defaultCfg, nil
	}

	if config.Simple == nil {
		config.Simple = defaultCfg.Simple
	}
	if config.SimpleJSON == nil {
		config.SimpleJSON = defaultCfg.SimpleJSON
	}
	if config.PrimaryAgent == nil {
		config.PrimaryAgent = defaultCfg.PrimaryAgent
	}
	if config.Assistant == nil {
		config.Assistant = defaultCfg.Assistant
	}
	if config.Generator == nil {
		config.Generator = defaultCfg.Generator
	}
	if config.Refiner == nil {
		config.Refiner = defaultCfg.Refiner
	}
	if config.Adviser == nil {
		config.Adviser = defaultCfg.Adviser
	}
	if config.Reflector == nil {
		config.Reflector = defaultCfg.Reflector
	}
	if config.Searcher == nil {
		config.Searcher = defaultCfg.Searcher
	}
	if config.Enricher == nil {
		config.Enricher = defaultCfg.Enricher
	}
	if config.Coder == nil {
		config.Coder = defaultCfg.Coder
	}
	if config.Installer == nil {
		config.Installer = defaultCfg.Installer
	}
	if config.Pentester == nil {
		config.Pentester = defaultCfg.Pentester
	}

	config.SetDefaultOptions(defaultCfg.GetDefaultOptions())

	return config, nil
}

func (pc *providerController) buildProviderFromConfig(
	prvtype provider.ProviderType,
	prvname provider.ProviderName,
	config *pconfig.ProviderConfig,
) (provider.Provider, error) {
	switch prvtype {
	case provider.ProviderOpenAI:
		return openai.New(pc.cfg, prvname, config)
	case provider.ProviderAnthropic:
		return anthropic.New(pc.cfg, prvname, config)
	case provider.ProviderCustom:
		return custom.New(pc.cfg, prvname, config)
	case provider.ProviderGemini:
		return gemini.New(pc.cfg, prvname, config)
	case provider.ProviderBedrock:
		return bedrock.New(pc.cfg, prvname, config)
	case provider.ProviderOllama:
		return ollama.New(pc.cfg, prvname, config)
	case provider.ProviderDeepSeek:
		return deepseek.New(pc.cfg, prvname, config)
	case provider.ProviderGLM:
		return glm.New(pc.cfg, prvname, config)
	case provider.ProviderKimi:
		return kimi.New(pc.cfg, prvname, config)
	case provider.ProviderQwen:
		return qwen.New(pc.cfg, prvname, config)
	default:
		return nil, fmt.Errorf("unknown provider type: %s", prvtype)
	}
}

func newAtomicInt64(seed int64) *atomic.Int64 {
	var number atomic.Int64

	if seed == 0 {
		bigID, err := rand.Int(rand.Reader, big.NewInt(math.MaxInt64))
		if err != nil {
			return &number
		}
		seed = bigID.Int64()
	}

	number.Store(seed)
	return &number
}
