# Veynt OSS — V1 Build Specification

## Product Overview

Veynt OSS is an AI-native pre-commit engineering reviewer that analyses Git diffs to detect:

* vulnerabilities
* architectural drift
* malicious AI rule changes
* AI-generated code slop
* poor engineering practices

before code enters the repository.

Unlike traditional linters or security scanners, Veynt learns the structure, conventions, and architectural patterns of the repository and uses that understanding as context during review.

The goal is to provide developers with a strict, senior-engineer-style review process directly in the CLI before code is committed or merged.

---

# Core Philosophy

## Primary Principles

* AI-first review engine
* Local-first execution
* No source code storage
* Repository-aware analysis
* Strong engineering standards
* Anti-slop by default
* Configurable strictness
* Developer-controlled architecture baselines

---

# Key Product Concepts

## 1. Repository Baseline

Veynt analyses the repository and generates a baseline profile that acts as the source of truth for future reviews.

The baseline includes:

* architecture patterns
* naming conventions
* separation of concerns
* framework usage
* dependency patterns
* utility reuse patterns
* nullability conventions
* comment density expectations
* project structure
* layering conventions

The baseline is committed to the repository.

---

## 2. AI-Native Diff Reviews

Veynt reviews:

* staged Git diffs
* branch diffs
* modified AI rule/config files

The AI receives a structured review context package rather than a raw diff.

The review context includes:

* repository baseline
* architectural profile
* framework profile
* staged changes
* impacted areas
* surrounding contextual files
* dependency changes
* rule/config modifications

---

## 3. Engineering Standards Enforcement

Veynt is intentionally strict.

The system should:

* discourage AI-generated code slop
* discourage unnecessary abstractions
* discourage over-commenting
* discourage rebuilding framework-native behaviour
* encourage reuse of existing utilities
* encourage typed models
* encourage clean separation of concerns
* encourage framework-native patterns

Examples:

* long method names indicating excessive responsibility
* logic placed in the wrong layer
* business rules duplicated outside their domain model
* excessive explanatory comments
* unnecessary dependencies
* nullable-heavy patterns
* over-engineered abstractions

---

# Supported Scanning Categories

## Security

* SQL injection
* XSS
* SSRF
* RCE
* insecure auth patterns
* insecure deserialisation
* path traversal
* secret exposure
* dangerous dependency additions

---

## AI Rule File Scanning

V1 support includes scanning:

* Cursor rule files
* Claude project instruction files
* MCP-related config files
* prompt/rule markdown files
* AI agent configuration files

Veynt should identify:

* suspicious permission escalation
* malicious instructions
* unsafe prompts
* hidden behavioural modifications
* risky tool access patterns

---

## AI Slop Detection

Veynt should identify:

* excessive abstraction
* over-engineering
* repetitive/generated-looking code
* vague or redundant naming
* giant changes for simple problems
* unnecessary helper layers
* over-commenting
* architecture inconsistency
* framework misuse
* duplicated business logic

---

# CLI Commands

## Core Commands

### Initialise Project

```bash
veynt init
```

Responsibilities:

* configure AI provider
* configure API keys
* configure strictness level
* configure review behaviour
* configure blocking thresholds
* configure suggestion behaviour
* create `.veynt/` directory
* install Git pre-commit hooks

`veynt init` should install hooks by default because the primary Veynt workflow is Git-integrated. A separate hook command may exist for repair or reinstall scenarios, but should not be part of the normal V1 setup flow.

---

### Analyse Repository

```bash
veynt analyse
```

Responsibilities:

* detect frameworks
* analyse architecture
* map repository structure
* infer engineering conventions
* infer dependency patterns
* identify layering conventions
* generate repository profile
* establish baseline standards

Output:

```text
.veynt/
  profile.yml
  architecture.yml
  standards.yml
```

This output is committed to the repository.

---

### Reinstall Git Hooks

```bash
veynt hooks reinstall
```

Responsibilities:

* repair or reinstall pre-commit hooks
* refresh local Git hook integration

This is a secondary maintenance command, not a required setup step.

---

### Scan Staged Changes

```bash
veynt scan
```

Responsibilities:

* analyse staged diff
* generate review context package
* send review context to configured AI provider
* block commit when thresholds exceeded

---

### Scan Branch Diff

```bash
veynt scan --branch main
```

Responsibilities:

* compare current branch against target branch
* perform final review checks
* intended for CI/CD usage

---

### Override Blocking

```bash
veynt override
```

Responsibilities:

* allow temporary override
* capture developer justification
* permit next commit

---

### Ignore Finding

```bash
veynt ignore finding-123
```

Responsibilities:

* suppress specific finding
* persist ignore configuration

---

### Configuration Commands

```bash
veynt config set review.strictness strict
```

Responsibilities:

* modify repository review behaviour
* modify detection thresholds
* modify scan preferences

---

# Strictness Levels

Supported levels:

```text
advisory
balanced
strict
critical
```

Strictness impacts:

* commit blocking behaviour
* naming scrutiny
* architecture enforcement
* slop sensitivity
* dependency warnings
* comment density tolerance

---

# Severity Model

Supported severities:

```text
info
low
medium
high
critical
```

Example configuration:

```yaml
blocking:
  local:
    - high
    - critical

  ci:
    - medium
    - high
    - critical
```

---

# Finding Structure

All findings use:

* severity
* category
* stable finding ID
* semantic rule ID
* reasoning
* optional suggested fix

Example:

```text
[MEDIUM][ARCHITECTURE]
VNT-2041 [architecture.logic-placement]

Reason:
This logic appears to belong in the WorkType enum rather than the service layer.

Suggested fix:
Move WFH derivation into the enum itself.
```

---

# Suppression Model

## Supported Suppression Types

### One-Time Override

```bash
veynt override
```

---

### Ignore Single Finding

```bash
veynt ignore finding-123
```

---

### Inline Suppression

```java
// veynt-ignore: false positive, validated manually
```

---

### Repo-Level Suppression

```yaml
ignore:
  - excessive-method-name
  - comment-density
```

---

# Configuration Model

## Repository Configuration

Stored in:

```text
.veynt/
```

Committed to repository.

Contains:

* review rules
* baseline architecture
* engineering standards
* blocking behaviour
* strictness settings

---

## Local User Configuration

Stored in:

```text
~/.veynt/
```

Contains:

* API keys
* provider preferences
* local overrides

---

## Environment Variable Overrides

Supported for:

* CI/CD pipelines
* temporary credentials
* automation

Examples:

```bash
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
GEMINI_API_KEY=...
```

Environment variables override local configuration.

---

# AI Provider Support

## V1 Supported Providers

* OpenAI
* Anthropic
* Gemini

---

## Provider Philosophy

Veynt does not store:

* source code
* diffs
* prompts
* findings
* repository metadata

Code only flows:

```text
Developer Machine -> Configured AI Provider
```

---

# Repository Analysis Behaviour

## V1 Repository Intelligence

V1 should infer:

* framework usage
* naming conventions
* utility reuse patterns
* architecture layering
* separation of concerns
* package responsibilities
* nullability patterns
* comment density
* dependency usage
* project structure

---

## Future Evolution

Later versions may include:

* semantic code graphs
* dependency relationship mapping
* historical behavioural analysis
* domain modelling
* architecture drift detection
* live vulnerability intelligence

---

# Framework Support

## V1 Focus

Backend:

* Spring Boot / Java
* Node.js / TypeScript frameworks

Frontend:

* React
* Angular

AI Tooling:

* Cursor rules
* Claude project instructions
* MCP configuration files
* prompt/rule markdown

Infrastructure scanning is intentionally out of scope for V1.

---

# Architecture Direction

## Runtime Language

Veynt OSS CLI should be built using:

```text
Node.js / TypeScript
```

Reasons:

* strong CLI ecosystem
* strong AI tooling ecosystem
* cross-platform support
* rapid OSS iteration
* Git tooling compatibility

---

# Review Context Package

## Internal Review Flow

1. Detect staged diff
2. Load repository baseline
3. Gather contextual files
4. Detect impacted areas
5. Build structured review package
6. Send to AI provider
7. Parse findings
8. Apply severity/blocking logic
9. Render CLI output
10. Allow or block commit

---

# Example Review Context

```yaml
repository:
  framework: spring-boot
  architectureStyle: layered
  strictness: critical

changes:
  filesChanged:
    - UserService.java
    - WorkType.java

context:
  relatedUtilities:
    - WorkType#isWFH

findings:
  expected:
    - architecture drift
    - duplicate business logic
```

---

# V1 MVP Scope

## Included

* CLI setup
* Git hook integration through `veynt init`
* staged diff scanning
* branch diff scanning
* repository analysis
* AI provider integration
* AI rule scanning
* severity system
* suppression system
* commit blocking
* architecture baseline generation
* configuration management

---

## Excluded

* hosted SaaS
* cloud dashboards
* live CVE feeds
* infrastructure scanning
* IDE plugins
* multi-agent orchestration
* local model support
* historical analytics
* PR commenting bots

---

# Future Roadmap

## Phase 2

* IDE integrations
* local model support
* semantic code graphing
* dependency intelligence
* PR review integrations
* enterprise policies
* architecture visualisation

---

## Phase 3

* hosted Veynt platform
* organisation-wide standards
* centralised governance
* historical reporting
* review analytics
* repository fleet management
* shared engineering profiles

---

# Initial Repository Structure

```text
veynt/
├── packages/
│   ├── cli/
│   ├── core/
│   ├── git/
│   ├── providers/
│   ├── analyzers/
│   ├── review-engine/
│   ├── findings/
│   ├── config/
│   └── hooks/
├── docs/
├── examples/
└── tests/
```

---

# Suggested Initial Backlog

## Core Platform

* Initialise Node.js monorepo
* Build CLI framework
* Build config loader
* Build environment variable support
* Build provider abstraction layer
* Build Git diff parser
* Build staged file collector

---

## Repository Analysis

* Framework detection engine
* Architecture inference engine
* Naming convention analyser
* Comment density analyser
* Dependency analysis engine
* Utility reuse detection

---

## AI Review Engine

* Review context pack builder
* AI provider adapters
* Prompt templates
* Structured finding parser
* Severity classifier
* Blocking engine

---

## Git Integration

* Pre-commit hook installer inside `veynt init`
* Commit blocking flow
* Override flow
* Ignore flow
* Branch diff support

---

## Rule File Scanning

* Cursor rules parser
* Claude instruction parser
* MCP config parser
* Prompt markdown analyser

---

## Developer Experience

* Pretty CLI renderer
* Coloured severity output
* Suggested fix formatting
* Config commands
* Init onboarding flow
* Verbose/debug mode

---

# Success Criteria for V1

V1 is successful if:

* developers trust findings
* false positives remain manageable
* commit-time reviews feel useful rather than noisy
* architecture drift is detected accurately
* AI slop detection feels genuinely intelligent
* teams adopt committed repository baselines
* onboarding takes under 10 minutes
* scans feel fast enough for daily development

---

# Final Product Positioning

## Short Positioning

> AI-native engineering reviews for Git diffs.

---

## Expanded Positioning

> Veynt OSS is an AI-native pre-commit engineering reviewer that analyses Git diffs to detect vulnerabilities, architectural drift, malicious AI rule changes, and low-quality AI-generated code before it enters the repository.
