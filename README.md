# Suricatoos

<div align="center">
    <strong>Autonomous penetration testing powered by AI agents</strong>
</div>

---

**Suricatoos** is a rebranded fork of [PentAGI](https://github.com/vxcontrol/pentagi) — an
automated security-testing platform that runs autonomous penetration-testing workflows using a
multi-agent system (Researcher, Developer, Executor) coordinating LLM providers,
Docker-sandboxed tool execution, and a persistent vector memory store.

This fork customizes the product identity (name, logo, and color system) for the **Suricatoos**
brand. The underlying functionality, architecture, and full credit belong to the upstream PentAGI
project by [vxcontrol](https://github.com/vxcontrol/pentagi).

## Brand

- **Primary blue** `#194fe3` · **Coral accent** `#FF7678` · white
- Mascot: a meerkat (*suricata*) forming the letter **"S"**.

## Quick Start

```bash
cp .env.example .env          # fill in DB + at least one LLM provider key
docker compose up -d
```

The full stack runs at `https://localhost:8443`.

### Development

```bash
# Backend (Go) — from backend/  (Go module: suricatoos)
go build -o suricatoos ./cmd/suricatoos
go test ./...

# Frontend (React + Vite) — from frontend/
pnpm install
pnpm run dev                   # http://localhost:8000
```

## Architecture

| Path | Role |
|---|---|
| `backend/` | Go REST + GraphQL API server (Go module `suricatoos`) |
| `frontend/` | React + TypeScript web UI |
| `observability/` | Optional monitoring stack (OpenTelemetry, Grafana, Langfuse) |

See [CLAUDE.md](CLAUDE.md) for the full development guide and architecture notes.

## Credits & License

Suricatoos is a fork of **PentAGI** (<https://github.com/vxcontrol/pentagi>) by vxcontrol.
The upstream copyright and the original `LICENSE`, `NOTICE`, and `EULA.md` are **preserved
unchanged**. Review them before redistribution.
