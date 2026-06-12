package graph

import (
	"suricatoos/pkg/config"
	"suricatoos/pkg/controller"
	"suricatoos/pkg/database"
	"suricatoos/pkg/database/knowledge"
	"suricatoos/pkg/graph/subscriptions"
	"suricatoos/pkg/providers"
	"suricatoos/pkg/server/auth"
	"suricatoos/pkg/templates"

	"github.com/sirupsen/logrus"
	"github.com/vxcontrol/cloud/anonymizer"
)

// This file will not be regenerated automatically.
//
// It serves as dependency injection for your app, add any dependencies you require here.

type Resolver struct {
	DB              database.Querier
	Config          *config.Config
	Logger          *logrus.Entry
	TokenCache      *auth.TokenCache
	DefaultPrompter templates.Prompter
	ProvidersCtrl   providers.ProviderController
	Controller      controller.FlowController
	Subscriptions   subscriptions.SubscriptionsController
	Knowledge       knowledge.KnowledgeStore
	Replacer        anonymizer.Replacer
}
