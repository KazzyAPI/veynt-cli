# Veynt OSS

AI-native pre-commit engineering reviewer for Git diffs.

Veynt analyses staged changes and branch diffs to detect vulnerabilities, architectural drift, malicious AI rule changes, and low-quality AI-generated code before it enters your repository.

## Quick Start

```bash
pnpm install
pnpm build
pnpm link --global  # or: node packages/cli/dist/index.js

cd your-project
veynt init
veynt analyse
git add .veynt/
git commit -m "Add Veynt baseline"

# Stage changes and scan
git add .
veynt scan
```

## Commands

| Command | Description |
|---------|-------------|
| `veynt init` | Configure provider, strictness, create `.veynt/`, install pre-commit hook |
| `veynt analyse` | Generate `profile.yml`, `architecture.yml`, `standards.yml` baseline |
| `veynt scan` | Review staged diff; blocks commit on threshold |
| `veynt scan --branch main` | Review branch diff (CI mode) |
| `veynt override` | One-time override for next commit |
| `veynt ignore VNT-0001` | Suppress a finding |
| `veynt config set review.strictness strict` | Update repo config |
| `veynt hooks reinstall` | Repair pre-commit hook |

## Configuration

**Repository** (committed): `.veynt/config.yml`, baseline profiles, ignore rules

**User** (local): `~/.veynt/config.yml` for API keys

**Environment** (CI): `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` override local keys

### Ollama (local)

No cloud API key required. Point Veynt at a running Ollama instance:

```yaml
# .veynt/config.yml
provider:
  name: ollama
  model: llama3.2
  baseUrl: http://127.0.0.1:11434  # optional; default shown
```

```bash
ollama serve
ollama pull llama3.2
veynt init --provider ollama
```

Override the host with `OLLAMA_HOST` or `provider.baseUrl`. For local models you can raise `review.chunking.requestsPerMinute` in config (cloud free tiers default to 5 RPM).

## Architecture

```
packages/
├── cli/           Command-line interface
├── core/          Shared types and utilities
├── config/        Configuration loading
├── git/           Diff parsing and Git operations
├── providers/     OpenAI, Anthropic, Gemini, Ollama adapters
├── analyzers/     Repository and rule file analysis
├── review-engine/ Context building and review orchestration
├── findings/      Parsing, blocking, suppression
└── hooks/         Pre-commit hook installation
```

## Development

```bash
pnpm install
pnpm build
pnpm test
```

## License

MIT
