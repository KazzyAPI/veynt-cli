<p align="center">
  <img src="./assets/veynt-icon-new-design.svg" alt="Veynt" width="72" height="72" />
</p>

<p align="center">
  <img src="./assets/veynt-wordmark-dark-new-design.svg" alt="Veynt" width="280" />
</p>

<p align="center">
  <strong>AI-native pre-commit engineering review for Git diffs.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/veynt-cli"><img src="https://img.shields.io/npm/v/veynt-cli?style=flat-square&color=7c5cff" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/veynt-cli"><img src="https://img.shields.io/npm/dm/veynt-cli?style=flat-square&color=3b82f6" alt="npm downloads" /></a>
  <a href="https://github.com/KazzyAPI/veynt-cli/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/veynt-cli?style=flat-square" alt="MIT licence" /></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/node/v/veynt-cli?style=flat-square" alt="Node.js" /></a>
</p>

<p align="center">
  Veynt analyses staged changes and branch diffs to detect vulnerabilities, architectural drift,
  malicious AI rule changes, and low-quality generated code before they enter your repository.
</p>

<p align="center">
  <a href="https://github.com/KazzyAPI/veynt-cli">GitHub</a>
  ·
  <a href="https://www.npmjs.com/package/veynt-cli">npm</a>
  ·
  <a href="https://github.com/KazzyAPI/veynt-cli/issues">Issues</a>
</p>

---

## Requirements

- **Node.js** 20 or later
- A **Git repository** with staged changes to review
- One AI provider: OpenAI, Anthropic, Google Gemini, or local Ollama

## Install

Install the CLI globally:

```bash
npm install -g veynt-cli
```

Verify the install:

```bash
veynt --version
```

The npm package is `veynt-cli`. The command on your PATH is `veynt`.

## Quick start

From the root of a Git repository:

```bash
cd your-repo

# Configure provider, strictness, and pre-commit hook
veynt init

# Generate repository baseline profiles
veynt analyse --wait

# Commit Veynt config and baseline to the repo
git add .veynt/
git commit -m "Add Veynt baseline"

# Stage work and scan before committing
git add .
veynt scan
```

After `veynt init`, every commit runs `veynt scan` automatically through the pre-commit hook.

## How it works

1. **Initialise** your repository with `veynt init`. Veynt stores config under `.veynt/` and installs a Git pre-commit hook.
2. **Analyse** the codebase with `veynt analyse` to build baseline profiles for architecture, standards, and repository context.
3. **Scan** staged diffs locally with `veynt scan`, or branch diffs in CI with `veynt scan --branch main`.
4. **Review findings** in the terminal. Commits can be blocked when severity exceeds your configured threshold.

Veynt reviews what you are about to commit, not your entire repository on every run.

## Provider setup

### Interactive setup

Run `veynt init` in a terminal. Veynt walks you through provider selection, review strictness, and API key storage.

### Non-interactive setup

```bash
veynt init --provider openai --strictness balanced -y
```

Supported providers:

| Provider | Flag | Default model |
|----------|------|---------------|
| OpenAI | `openai` | `gpt-4o-mini` |
| Anthropic | `anthropic` | `claude-3-5-haiku-latest` |
| Google Gemini | `gemini` | `gemini-2.5-flash` |
| Ollama (local) | `ollama` | `deepseek-v3.2` |

### API keys

**Local user config** (recommended for development):

```bash
export OPENAI_API_KEY="your-key"
# or
export ANTHROPIC_API_KEY="your-key"
# or
export GEMINI_API_KEY="your-key"
```

Keys can also be saved to `~/.veynt/config.yml` during interactive `veynt init`.

**CI and automation:** set the same environment variables in your pipeline. Environment variables override local user config.

### Ollama (local, no cloud API key)

```bash
ollama serve
ollama pull deepseek-v3.2

veynt init --provider ollama -y
```

Optional host override in `.veynt/config.yml`:

```yaml
provider:
  name: ollama
  model: deepseek-v3.2
  baseUrl: http://127.0.0.1:11434
```

You can also set `OLLAMA_HOST`. For local models, consider raising `review.chunking.requestsPerMinute` in config. Cloud free tiers default to 5 requests per minute.

## Configuration

Veynt separates repository config from personal credentials.

| Scope | Location | Committed to Git |
|-------|----------|------------------|
| Repository | `.veynt/config.yml` | Yes |
| Baseline profiles | `.veynt/*.yml` | Yes |
| Ignore rules | `.veynt/config.yml` | Yes |
| API keys | `~/.veynt/config.yml` | No |

### Strictness levels

| Level | Typical use |
|-------|-------------|
| `advisory` | Surface findings without blocking commits |
| `balanced` | Default. Block high and critical issues locally |
| `strict` | Tighter local enforcement |
| `critical` | Block only critical findings |

Update strictness at any time:

```bash
veynt config set review.strictness strict
veynt config show
```

## Commands

| Command | Description |
|---------|-------------|
| `veynt init` | Configure Veynt and install Git pre-commit hooks |
| `veynt analyse` | Generate repository baseline profiles |
| `veynt analyse --wait` | Run analysis in the foreground until complete |
| `veynt scan` | Review staged changes |
| `veynt scan --branch main` | Review branch diff against a target branch (CI mode) |
| `veynt override` | Allow a one-time override for the next commit |
| `veynt ignore VNT-0001` | Suppress a specific finding |
| `veynt config show` | Show resolved configuration |
| `veynt config set <key> <value>` | Update repository configuration |
| `veynt hooks reinstall` | Repair or reinstall the pre-commit hook |

## CI usage

Run Veynt against a branch diff in GitHub Actions or any CI runner:

```yaml
- name: Install Veynt
  run: npm install -g veynt-cli

- name: Review branch diff
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
  run: veynt scan --branch main
```

Ensure `.veynt/` is committed to the repository so CI uses the same baseline and rules as local development.

## Workflow tips

- Commit `.veynt/` after `veynt analyse` so your team shares the same baseline.
- Use `veynt scan` manually when you want feedback before staging everything.
- Use `veynt override --reason "..."` sparingly and only with a clear justification.
- Reinstall hooks after cloning or if the pre-commit hook stops firing: `veynt hooks reinstall`.

## Troubleshooting

**`veynt: command not found`**

Confirm the global npm bin directory is on your PATH, then reinstall:

```bash
npm install -g veynt-cli
```

**Authentication or provider errors**

Check that the correct API key environment variable is set, or rerun `veynt init` interactively.

**Hook not running**

```bash
veynt hooks reinstall
```

**Analysis still running**

```bash
veynt analyse --status
veynt analyse --wait
```

## Development

To work on Veynt itself, clone the monorepo:

```bash
git clone https://github.com/KazzyAPI/veynt-cli.git
cd veynt-cli
pnpm install
pnpm build
pnpm test
```

## Licence

MIT
