# Multi-Agent Code Review System

A Claude Code agent team that runs three specialized reviewers in parallel,
facilitates a cross-agent discussion, and synthesizes a final prioritized report.

## Agents

| Agent | File | Focus |
|---|---|---|
| Security Reviewer | `agents/security-reviewer.md` | Vulnerabilities, OWASP Top 10, secrets, authz |
| Code Quality Reviewer | `agents/quality-reviewer.md` | SOLID, code smells, testing, readability |
| Architecture Reviewer | `agents/architecture-reviewer.md` | Structure, coupling, scalability, observability |
| Orchestrator | `commands/review.md` | Coordinates all three + discussion round |

## Usage

From within any project in Claude Code, run:

```
/review
```

That's it. The orchestrator handles everything automatically:

1. **Reconnaissance** — maps your repo structure and samples representative code
2. **Parallel Review** — all 3 agents run simultaneously with their findings
3. **Discussion Round** — each agent reads the others' findings and cross-analyzes
4. **Final Report** — saved as `REVIEW_REPORT.md` in your project root

## How the Discussion Works

After the initial review, each agent runs a second time with all three reports.
They're asked to:
- Flag findings from peers that have implications in their own domain
- Challenge or validate peer findings where they intersect
- Surface new concerns they missed the first time

This catches issues that span domains — e.g., a code smell that's also a security
vulnerability, or an architectural decision that's the root cause of quality problems.

## Installation

Copy the entire `.claude/` directory into your project root:

```
your-project/
└── .claude/
    ├── agents/
    │   ├── security-reviewer.md
    │   ├── quality-reviewer.md
    │   └── architecture-reviewer.md
    └── commands/
        └── review.md
```

The agent files in `agents/` are reference documents for the personas used in
the orchestrator's Task calls. They are not loaded automatically by Claude Code
but serve as living documentation for each agent's scope and output format.

## Customizing Agents

Each agent file defines:
- **Identity** — the persona and expertise level
- **Responsibilities** — what to look for
- **Review Checklist** — specific areas to examine
- **Output Format** — structured report template

Edit the relevant `.md` file to tune an agent's focus. For example, if your
project uses specific frameworks (Rails, Django, Spring), add framework-specific
checks to the relevant agent.

## Tips

- Run `/review` on a feature branch after significant changes
- The report is saved as `REVIEW_REPORT.md` — add it to `.gitignore` or
  commit it as a point-in-time artifact depending on your workflow
- For large repos, the reconnaissance phase may take a few minutes as agents
  read representative files before reviewing
- The discussion round adds meaningful depth — agents frequently surface
  cross-domain issues the first pass misses

## Token Considerations

This pipeline runs 6 agent Tasks total (3 review + 3 discussion). On large
repos this can use significant context. If you hit limits:
- Scope the review to a specific subdirectory by modifying the prompt
- Run individual agents instead of the full orchestrator
