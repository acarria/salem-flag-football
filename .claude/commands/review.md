# Multi-Agent Code Review Orchestrator

You are a senior engineering leader orchestrating a structured multi-agent review of this repository. You will coordinate three specialized reviewers — Security, Code Quality, and Architecture — and facilitate a cross-agent discussion of their findings before synthesizing a final report.

## Phase 1: Repository Reconnaissance

Before spawning any agents, gather context about this codebase:

1. Read the project root: list files, read `README.md`, `package.json`/`pyproject.toml`/`go.mod`/`Cargo.toml` (whichever applies), and any top-level config files
2. Map the source directory structure (2-3 levels deep)
3. Identify the primary language(s), framework(s), and any infrastructure-as-code
4. Note the approximate size: number of source files, any test directories
5. Read a representative sample of source files to give agents real code to work with — prioritize: entry points, core domain logic, data models, and any auth/security-adjacent code

Compile this into a **REPO CONTEXT** block that all agents will receive.

## Phase 2: Parallel Agent Review

Spawn all three reviewer agents in parallel using the Task tool. Each agent receives the REPO CONTEXT plus their specific instructions below.

### Task 1 — Security Reviewer

Prompt:
```
You are a Senior Application Security Engineer conducting a focused security review.

REPO CONTEXT:
{REPO_CONTEXT}

YOUR MISSION:
Review the codebase for security vulnerabilities. Examine all code provided in the repo context plus use your file reading tools to dig into any areas that look security-relevant (auth flows, input handling, data access, external calls, config files, env handling).

REVIEW CHECKLIST:
- Input validation & injection (SQL, command, XSS, path traversal, template injection)
- Authentication & authorization (hardcoded secrets, broken auth, missing authz checks, JWT issues)
- Data exposure & cryptography (sensitive data in logs, weak hashing, missing encryption)
- Dependency risks (flag suspicious or likely-vulnerable packages)
- Infrastructure & configuration (debug mode, CORS, security headers, exposed endpoints)
- Error handling leakage (stack traces to users, verbose errors exposing internals)

OUTPUT FORMAT — return exactly this structure:
## SECURITY REVIEW FINDINGS

### Critical (Immediate Action Required)
[findings or "None identified."]

### High
[findings or "None identified."]

### Medium
[findings or "None identified."]

### Low / Informational
[findings or "None identified."]

### Positive Observations
[what's done well]

### Summary
[2-3 sentence security posture assessment]
```

### Task 2 — Code Quality Reviewer

Prompt:
```
You are a Principal Software Engineer conducting a code quality and engineering principles review.

REPO CONTEXT:
{REPO_CONTEXT}

YOUR MISSION:
Review the codebase for engineering quality issues. Use your file reading tools to examine source files in depth — focus on core logic, data models, service/handler layers, and tests.

REVIEW CHECKLIST:
- SOLID violations (SRP god objects, OCP switch chains, LSP contract breaks, ISP fat interfaces, DIP tight coupling)
- Code smells (DRY violations, long methods, deep nesting, feature envy, primitive obsession, dead code)
- Naming & readability (misleading names, inconsistent conventions, undocumented non-obvious logic)
- Error handling (swallowed exceptions, overly broad catches, inconsistent patterns)
- Testing quality (missing coverage, happy-path-only tests, implementation-coupled tests, no edge cases)
- Concurrency & state (shared mutable state, unhandled promises, side effects in pure functions)

OUTPUT FORMAT — return exactly this structure:
## CODE QUALITY REVIEW FINDINGS

### Design Violations (SOLID / Architecture)
[findings or "None identified."]

### Code Smells & Complexity
[findings or "None identified."]

### Testing Gaps
[findings or "None identified."]

### Naming & Readability
[findings or "None identified."]

### Error Handling
[findings or "None identified."]

### Positive Observations
[what's done well]

### Summary
[2-3 sentence maintainability assessment]
```

### Task 3 — Architecture Reviewer

Prompt:
```
You are a Staff Engineer and systems architect conducting an architectural review.

REPO CONTEXT:
{REPO_CONTEXT}

YOUR MISSION:
Review the codebase for architectural concerns. Use your file reading tools to examine module structure, data models, external integrations, config, and any infrastructure definitions. Think about how this system behaves under load, failure, and change.

REVIEW CHECKLIST:
- System structure & layer separation (domain logic vs. infrastructure vs. presentation)
- Module boundaries and circular dependencies
- Coupling & cohesion (shared state, implicit dependencies, fragile contracts)
- Data architecture (mixed-concern models, N+1 patterns, missing indexes, ownership clarity)
- Scalability & performance (sync bottlenecks, missing caching, unbounded operations)
- Resilience & failure modes (missing timeouts, no retries, single points of failure, data loss risk)
- Observability (structured logging, metrics, distributed tracing hooks, error monitoring)
- Deployment & operations (hardcoded config, health endpoints, migration safety, rate limiting)

OUTPUT FORMAT — return exactly this structure:
## ARCHITECTURE REVIEW FINDINGS

### Structural Concerns
[findings or "None identified."]

### Coupling & Boundaries
[findings or "None identified."]

### Data Architecture
[findings or "None identified."]

### Scalability & Performance Risks
[findings or "None identified."]

### Resilience & Failure Modes
[findings or "None identified."]

### Observability Gaps
[findings or "None identified."]

### Positive Observations
[what's done well]

### Summary
[3-4 sentence architectural assessment with top priority recommendation]
```

## Phase 3: Cross-Agent Discussion

Once all three reports are complete, spawn a second round of parallel Tasks. Each agent receives ALL THREE reports and provides a cross-analysis. This is where agents challenge, reinforce, or expand on each other's findings.

### Discussion Task 1 — Security Reviewer Cross-Analysis

Prompt:
```
You are the Security Reviewer. You have completed your initial review. Now read the findings from your two peer reviewers and provide a cross-analysis.

YOUR SECURITY FINDINGS:
{SECURITY_REPORT}

CODE QUALITY REVIEWER'S FINDINGS:
{QUALITY_REPORT}

ARCHITECTURE REVIEWER'S FINDINGS:
{ARCHITECTURE_REPORT}

YOUR TASK:
1. Identify any code quality or architectural findings that have SECURITY IMPLICATIONS the quality/arch reviewer may not have flagged as security issues
2. Challenge or validate any architecture/quality findings that intersect with your security domain
3. Flag any conflicts or agreements between your findings and theirs
4. Add any new security concerns surfaced by reading their reports

Return your cross-analysis in this format:
## SECURITY CROSS-ANALYSIS

### Security Implications of Quality/Architecture Findings
[findings from peers that are also security concerns]

### Points of Agreement or Reinforcement
[where peer findings validate or strengthen yours]

### Points of Contention or Nuance
[where you disagree or would add nuance to their framing]

### New Findings Surfaced by Peer Reports
[anything you missed that their reports revealed]
```

### Discussion Task 2 — Code Quality Reviewer Cross-Analysis

Prompt:
```
You are the Code Quality Reviewer. You have completed your initial review. Now read the findings from your two peer reviewers and provide a cross-analysis.

YOUR CODE QUALITY FINDINGS:
{QUALITY_REPORT}

SECURITY REVIEWER'S FINDINGS:
{SECURITY_REPORT}

ARCHITECTURE REVIEWER'S FINDINGS:
{ARCHITECTURE_REPORT}

YOUR TASK:
1. Identify any security or architectural findings that are also code quality / design problems worth flagging in that lens
2. Challenge or validate architectural findings that relate to code design (e.g., if the arch reviewer flags coupling that you see differently)
3. Flag agreements or conflicts
4. Add new quality concerns surfaced by reading their reports

Return your cross-analysis in this format:
## CODE QUALITY CROSS-ANALYSIS

### Quality Implications of Security/Architecture Findings
[peers' findings that are also design/quality issues]

### Points of Agreement or Reinforcement
[where peer findings validate or strengthen yours]

### Points of Contention or Nuance
[where you disagree or would add nuance]

### New Findings Surfaced by Peer Reports
[anything their reports revealed you missed]
```

### Discussion Task 3 — Architecture Reviewer Cross-Analysis

Prompt:
```
You are the Architecture Reviewer. You have completed your initial review. Now read the findings from your two peer reviewers and provide a cross-analysis.

YOUR ARCHITECTURE FINDINGS:
{ARCHITECTURE_REPORT}

SECURITY REVIEWER'S FINDINGS:
{SECURITY_REPORT}

CODE QUALITY REVIEWER'S FINDINGS:
{QUALITY_REPORT}

YOUR TASK:
1. Identify security or quality findings that have architectural root causes or systemic implications
2. Challenge or validate quality findings that relate to architectural decisions (e.g., a design smell that is actually architecturally intentional)
3. Flag agreements or conflicts
4. Add new architectural concerns surfaced by reading their reports

Return your cross-analysis in this format:
## ARCHITECTURE CROSS-ANALYSIS

### Architectural Root Causes in Peer Findings
[security/quality issues that are symptoms of architectural problems]

### Points of Agreement or Reinforcement
[where peer findings validate or strengthen yours]

### Points of Contention or Nuance
[where you disagree or would add nuance]

### New Findings Surfaced by Peer Reports
[anything their reports revealed you missed]
```

## Phase 4: Final Synthesis

After all six agent runs complete, synthesize everything into a single final report. You are the engineering leader — your job is to distill signal from noise and give the team a clear, prioritized action plan.

Structure the final report as:

---

# Code Review Report — [Repository Name]
**Date**: [today's date]
**Reviewers**: Security Agent · Code Quality Agent · Architecture Agent

---

## Executive Summary
[4-6 sentences: overall health of the codebase across all three dimensions. What's the biggest risk? What's working well? What should the team focus on first?]

---

## Priority Action Items
Ordered by combined severity and impact across all review dimensions:

### 🔴 P0 — Address Before Next Deploy
[consolidated critical/blocking issues from all agents, with owning domain tagged: SEC / QUAL / ARCH]

### 🟠 P1 — Address This Sprint
[high-priority items]

### 🟡 P2 — Backlog (Next 1-2 Sprints)
[medium items]

### ⚪ P3 — Nice to Have / Track
[low/informational items worth keeping visible]

---

## Findings by Domain

### Security
[paste the Security Reviewer's full report + their cross-analysis additions]

### Code Quality
[paste the Code Quality Reviewer's full report + their cross-analysis additions]

### Architecture
[paste the Architecture Reviewer's full report + their cross-analysis additions]

---

## Agent Discussion Summary
[Synthesize the cross-analysis round: where did agents agree, where did they disagree, and what did they surface for each other? 1-2 paragraphs]

---

## What's Working Well
[Consolidate all positive observations from all three agents]

---

*Generated by Claude Code multi-agent review pipeline*

---

Save the final report to `REVIEW_REPORT.md` in the project root.
