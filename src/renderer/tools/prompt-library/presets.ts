export interface PresetPrompt {
  id: string
  title: string
  category: 'analyzing' | 'building-apps' | 'creating-reports' | 'system-design' | 'writing-review'
  categoryLabel: string
  description: string
  body: string
  tags: string[]
}

export interface PresetCategory {
  id:
    'all' | 'analyzing' | 'building-apps' | 'creating-reports' | 'system-design' | 'writing-review'
  label: string
  description: string
}

export const PRESET_CATEGORIES: PresetCategory[] = [
  {
    id: 'all',
    label: 'All Presets',
    description: 'Browse all curated engineering prompt templates'
  },
  {
    id: 'analyzing',
    label: 'Analyzing & Auditing',
    description: 'Code review, vulnerability scanning, performance & data analysis'
  },
  {
    id: 'building-apps',
    label: 'Building Apps',
    description: 'Architecture blueprints, scaffolding, APIs, components & testing'
  },
  {
    id: 'creating-reports',
    label: 'Creating Reports',
    description: 'Executive summaries, post-mortems, PRDs, RFCs & release notes'
  },
  {
    id: 'system-design',
    label: 'System Design',
    description: 'Distributed systems, database schemas, scale planning & threat models'
  },
  {
    id: 'writing-review',
    label: 'Writing & Review',
    description: 'Senior mentorship, refactoring plans, PR write-ups & documentation'
  }
]

export const PROMPT_PRESETS: PresetPrompt[] = [
  // ==========================================
  // 1. ANALYZING & AUDITING
  // ==========================================
  {
    id: 'analyze-code-review-senior',
    title: 'Senior Code Review & Defect Audit',
    category: 'analyzing',
    categoryLabel: 'Analyzing & Auditing',
    description:
      'Thorough review covering logic errors, edge cases, memory leaks, and maintainability.',
    tags: ['code-review', 'analyzing', 'quality'],
    body: `Act as a Staff Principal Engineer. Review the following {{language}} code with extreme scrutiny.

Evaluate the implementation across these 5 dimensions:
1. **Logical Correctness & Edge Cases:** Identify race conditions, off-by-one errors, null/undefined traps, and unexpected inputs.
2. **Performance & Complexity:** Detect unnecessary allocations, O(n²) bottlenecks, and unindexed queries.
3. **Security Risks:** Scan for injection, unvalidated deserialization, broken access control, and information disclosure.
4. **Idiomatic Patterns:** Assess adherence to modern {{language}} conventions and anti-slop design.
5. **Concrete Remediation:** For every critical or major issue, provide the exact line-level diff fix.

Code under review:
\`\`\`{{language}}
{{code}}
\`\`\``
  },
  {
    id: 'analyze-security-threat-model',
    title: 'STRIDE Security & Threat Model Audit',
    category: 'analyzing',
    categoryLabel: 'Analyzing & Auditing',
    description: 'Systematic STRIDE threat analysis on an architecture component or data flow.',
    tags: ['security', 'analyzing', 'threat-model'],
    body: `Act as an Application Security Architect. Perform a STRIDE threat modeling analysis on the following system component:

**Component / Architecture Description:**
{{system_description}}

**Data Assets & Trust Boundaries:**
{{data_assets}}

Please output a structured markdown report with:
1. **Trust Boundary Identification:** Where untrusted data enters the boundary.
2. **STRIDE Threat Matrix:**
   - **Spoofing:** Identity falsification risks.
   - **Tampering:** Unauthorized modification of payload or storage.
   - **Repudiation:** Inability to prove an action occurred.
   - **Information Disclosure:** Data leaks and sensitive telemetry.
   - **Denial of Service:** Resource exhaustion and amplification attacks.
   - **Elevation of Privilege:** Vertical or horizontal bypasses.
3. **Prioritized Mitigation Checklist:** Concrete cryptographic and architectural countermeasures prioritized by CVSS severity.`
  },
  {
    id: 'analyze-sql-query-bottleneck',
    title: 'SQL Query & Index Optimization Plan',
    category: 'analyzing',
    categoryLabel: 'Analyzing & Auditing',
    description:
      'Analyze slow SQL queries, explain plans, and table schemas to propose indexing and structural fixes.',
    tags: ['sql', 'database', 'analyzing', 'performance'],
    body: `Act as a Senior Database Administrator specialized in {{database_engine}} (e.g. PostgreSQL, SQLite, MySQL).

Analyze the following query and explain output to eliminate slow scans and lock contention:

**Target Query:**
\`\`\`sql
{{query}}
\`\`\`

**Table Schema & Existing Indexes:**
\`\`\`sql
{{schema}}
\`\`\`

**Explain Plan / Execution Profile:**
\`\`\`
{{explain_output}}
\`\`\`

Provide:
1. **Root Cause Diagnosis:** Why the planner chose sequential scans, temporary files, or nested loop joins.
2. **Optimized Query Rewrite:** Rewritten SQL leveraging CTEs, subqueries, or window functions where beneficial.
3. **Index Recommendation:** Exact DDL statements for composite or partial indexes with column order rationale.`
  },
  {
    id: 'analyze-log-crash-dump',
    title: 'Production Incident Log & Crash Analysis',
    category: 'analyzing',
    categoryLabel: 'Analyzing & Auditing',
    description:
      'Extract root cause, timeline of events, and blast radius from stack traces and logs.',
    tags: ['logs', 'debugging', 'analyzing', 'incident'],
    body: `Act as an SRE Reliability Lead. Analyze this production log stream and stack trace to pinpoint the failure origin:

**Service & Context:**
{{service_name}} running on {{runtime_environment}}

**Log Excerpt / Stack Trace:**
\`\`\`
{{log_excerpt}}
\`\`\`

Provide a forensic breakdown:
1. **Root Cause Hypothesis:** The precise trigger that initiated the failure cascade.
2. **Failure Sequence:** Chronological timeline reconstructed from log timestamps.
3. **Affected Subsystems & Blast Radius:** What upstream or downstream dependencies failed as a consequence.
4. **Immediate Hotfix:** The emergency code or config change to stop the bleeding.
5. **Long-Term Preventive Action:** Tests and circuit breakers to prevent recurrence.`
  },
  {
    id: 'analyze-complexity-benchmarking',
    title: 'Algorithm Time & Space Complexity Evaluation',
    category: 'analyzing',
    categoryLabel: 'Analyzing & Auditing',
    description: 'Formal Big-O time and space complexity derivation with optimization suggestions.',
    tags: ['algorithm', 'performance', 'analyzing'],
    body: `Act as a Computer Science Theory Specialist. Analyze the formal time and space complexity of the following algorithm:

\`\`\`{{language}}
{{algorithm_code}}
\`\`\`

Expected input scale: {{input_scale}}

Provide:
1. **Time Complexity:** Best, average, and worst-case Big-O notation with mathematical derivation.
2. **Space Complexity:** Auxiliary heap allocations vs. call-stack frames.
3. **Hardware & Cache Analysis:** Impact of memory locality, cache line misses, and branch mispredictions.
4. **Optimized Alternative:** An algorithmic rewrite achieving better theoretical or practical throughput.`
  },
  {
    id: 'analyze-data-distribution-anomalies',
    title: 'Dataset Quality & Anomaly Discovery',
    category: 'analyzing',
    categoryLabel: 'Analyzing & Auditing',
    description:
      'Evaluate tabular or JSON data for missing distributions, outliers, and data corruption.',
    tags: ['data', 'analyzing', 'statistics'],
    body: `Act as a Senior Data Engineer. Analyze the sample dataset below for statistical anomalies, missing distributions, and formatting irregularities:

**Data Format & Domain:** {{data_domain}}
\`\`\`
{{sample_data}}
\`\`\`

Provide:
1. **Data Health Audit:** Missing values, inconsistent type coercion, cardinality mismatches, and syntax defects.
2. **Distribution & Outlier Flags:** Numeric skew, unexpected bimodal spikes, or categorical anomalies.
3. **Schema Sanitization Script:** A Python or TypeScript sanitization routine to clean, validate, and normalize incoming batches.`
  },

  // ==========================================
  // 2. BUILDING APPS & ENGINEERING
  // ==========================================
  {
    id: 'build-fullstack-scaffold',
    title: 'Full-Stack Application Blueprint & Scaffolding',
    category: 'building-apps',
    categoryLabel: 'Building Apps',
    description:
      'Complete production folder structure, technical boundaries, and setup instructions.',
    tags: ['architecture', 'building-apps', 'fullstack'],
    body: `You are a Principal Software Architect. I need to scaffold a production-grade application for {{app_concept}}.

**Tech Stack:**
- Frontend: {{frontend_framework}}
- Backend / API: {{backend_framework}}
- Database / Storage: {{database}}
- Styling / Design: {{styling_library}}

Please construct a comprehensive architecture specification:
1. **Clean Directory Tree:** File-by-file organization demonstrating clear separation of concerns (domain core, infrastructure, UI primitives, hooks, API routes).
2. **State & Data Flow:** Client state vs. server state management strategy.
3. **Core Interface Contracts:** TypeScript types for the primary domain entities.
4. **Security & Validation Guardrails:** Input sanitization, CORS, rate-limiting, and authentication token flow.
5. **Phase-by-Phase MVP Checklist:** Step-by-step implementation milestones from initial commit to first release.`
  },
  {
    id: 'build-rest-api-spec',
    title: 'RESTful API Specification & Contract Design',
    category: 'building-apps',
    categoryLabel: 'Building Apps',
    description:
      'Design idempotent, semantic REST API endpoints with request/response schemas and status codes.',
    tags: ['api', 'building-apps', 'backend', 'rest'],
    body: `Act as an API Platform Architect. Design a production-grade REST API contract for the following business domain:

**Resource & Domain:**
{{resource_domain}}

**Key User Capabilities:**
{{capabilities}}

Produce a comprehensive API specification in Markdown:
1. **Endpoint Roster:** Paths, HTTP methods (GET, POST, PUT, PATCH, DELETE), and authentication requirements.
2. **Request Payloads:** JSON schema examples with strict field validation rules (types, bounds, regex).
3. **Response Shapes:** Standard 200/201 success payloads alongside structured error envelopes (RFC 7807 Problem Details).
4. **Pagination & Filtering:** Standards for cursor-based pagination, sorting, and field masking.
5. **Idempotency Strategy:** Safe retry mechanisms using Idempotency-Key headers.`
  },
  {
    id: 'build-relational-schema-prisma',
    title: 'Relational Database Schema & Migrations',
    category: 'building-apps',
    categoryLabel: 'Building Apps',
    description:
      'Design normalized SQL / Prisma relational models with indexes, foreign keys, and constraints.',
    tags: ['database', 'schema', 'sql', 'building-apps'],
    body: `Act as a Database Architect. Design a normalized 3NF database schema for:

**Application Requirements:**
{{business_requirements}}

**Target Database / ORM:**
{{database_or_orm}} (e.g. PostgreSQL, SQLite, Prisma Schema, Drizzle)

Output:
1. **Entity Relationship Overview:** Cardinality (1:1, 1:N, M:N) and relationship justification.
2. **Production DDL / Schema Code:**
   - Explicit primary keys (UUIDv7 or auto-increment)
   - Foreign key constraints with explicit ON DELETE rules
   - CHECK constraints and default timestamps (created_at, updated_at)
   - Covering indexes for hot query paths
3. **Sample Seed Data:** Minimal realistic seed records demonstrating relational integrity.`
  },
  {
    id: 'build-component-state-machine',
    title: 'UI Component State Machine & Accessibility Spec',
    category: 'building-apps',
    categoryLabel: 'Building Apps',
    description:
      'Define deterministic finite states, keyboard navigation, and ARIA attributes for complex components.',
    tags: ['ui', 'frontend', 'accessibility', 'building-apps'],
    body: `Act as a Senior Design Systems & Frontend Engineer. Design the finite state machine and accessibility implementation for the following UI component:

**Component Name & Purpose:**
{{component_name}}

**Interactions & Features:**
{{interactions}}

Provide:
1. **State Machine Definition:** Exhaustive list of states (idle, loading, active, disabled, error, dragging) and legal transitions.
2. **Keyboard Navigation Matrix:** Exact key bindings (Arrow keys, Tab, Enter, Escape, Space) and focus traps.
3. **WAI-ARIA Roles & Attributes:** Required role, aria-expanded, aria-controls, aria-live, and tabIndex semantics.
4. **TypeScript Implementation:** Modern React/TypeScript component structure with zero layout shift and restrained transitions.`
  },
  {
    id: 'build-comprehensive-unit-tests',
    title: 'Comprehensive Unit & Edge-Case Test Suite',
    category: 'building-apps',
    categoryLabel: 'Building Apps',
    description:
      'Generate high-coverage unit tests with boundary testing, mocks, and failure cases.',
    tags: ['testing', 'vitest', 'building-apps', 'qa'],
    body: `Act as a QA Lead & Test Automation Engineer. Generate a comprehensive unit test suite using {{test_runner}} (e.g. Vitest, Jest, PyTest) for the following code:

**Implementation Under Test:**
\`\`\`{{language}}
{{source_code}}
\`\`\`

Test Suite Requirements:
1. **Happy Path Scenarios:** Standard operational expectations.
2. **Boundary & Edge Conditions:** Minimum/maximum inputs, empty collections, zero values, unicode strings.
3. **Defensive Error Handling:** Asserting that invalid inputs throw specific structured errors.
4. **Mocking Boundaries:** Clean mocking of external I/O, timers, or network calls without leaking state.
5. **No Weak Assertions:** Explicit assertions testing exact outcomes rather than truthiness.`
  },
  {
    id: 'build-dockerfile-cicd',
    title: 'Hardened Multi-Stage Dockerfile & CI Pipeline',
    category: 'building-apps',
    categoryLabel: 'Building Apps',
    description:
      'Minimal multi-stage Docker build with non-root security and GitHub Actions pipeline.',
    tags: ['docker', 'devops', 'building-apps', 'ci-cd'],
    body: `Act as a DevSecOps Engineer. Generate a hardened, production-ready containerization setup for:

**Application Stack:**
{{stack_details}}

Provide:
1. **Multi-Stage Dockerfile:**
   - Minimal base image (Alpine / Distroless)
   - Cache-optimized layer ordering for dependencies
   - Non-root user execution
   - Security-scanned dependencies and stripped dev tooling
2. **.dockerignore Configuration:** Preventing credential and build artifact leaks.
3. **GitHub Actions Workflow:** Automated pipeline running lint, test, container build, and artifact caching.`
  },
  {
    id: 'build-refactor-legacy-module',
    title: 'Zero-Regression Legacy Refactoring Plan',
    category: 'building-apps',
    categoryLabel: 'Building Apps',
    description: 'Transform spaghetti or monolithic code into modular, typed, clean architecture.',
    tags: ['refactoring', 'clean-code', 'building-apps'],
    body: `Act as a Principal Refactoring Specialist. Refactor the following legacy {{language}} module into clean, testable, and maintainable architecture:

**Legacy Code:**
\`\`\`{{language}}
{{legacy_code}}
\`\`\`

**Refactoring Goals:**
{{goals}}

Deliver:
1. **Architectural Weakness Summary:** Code smells identified (God objects, tight coupling, side effects).
2. **Refactored Implementation:** Clean rewrite adhering to Single Responsibility, Dependency Inversion, and immutability.
3. **Migration Steps:** Safe incremental steps to swap out the legacy module with zero downtime or regressions.`
  },

  // ==========================================
  // 3. CREATING REPORTS & DOCUMENTATION
  // ==========================================
  {
    id: 'report-executive-summary',
    title: 'Executive Stakeholder Summary Brief',
    category: 'creating-reports',
    categoryLabel: 'Creating Reports',
    description:
      'Translate technical milestones, metrics, and obstacles into crisp business executive briefs.',
    tags: ['executive', 'management', 'creating-reports'],
    body: `Act as a VP of Engineering. Synthesize the following technical progress and metrics into a high-impact Executive Brief for non-technical leadership:

**Technical Data & Progress Notes:**
{{technical_notes}}

**Target Audience:** {{executive_audience}} (e.g. CEO, Board of Directors, Product Executives)

Format the report with:
1. **Bottom Line Up Front (BLUF):** 2-sentence summary of status and core business impact.
2. **Strategic Wins & Milestones Achieved:** Concrete deliverables tied to business velocity.
3. **Key Performance Metrics:** Velocity, uptime, latency, or cost improvements formatted in a clean table.
4. **Risks & Blockers:** High-level overview of blockers with requested resource or prioritization decisions.
5. **Next Horizon Focus:** 3 critical objectives for the upcoming sprint or quarter.`
  },
  {
    id: 'report-incident-postmortem',
    title: 'Blameless Incident Post-Mortem & RCA',
    category: 'creating-reports',
    categoryLabel: 'Creating Reports',
    description:
      'Standard blameless post-mortem covering root cause analysis, timeline, and corrective actions.',
    tags: ['incident', 'postmortem', 'creating-reports', 'sre'],
    body: `Act as a Site Reliability Engineering (SRE) Director. Write a blameless post-mortem report for the following service outage:

**Incident Summary:**
- Incident Name: {{incident_name}}
- Date & Duration: {{incident_date_duration}}
- Services Impacted: {{impacted_services}}
- Raw Incident Timeline & Notes:
{{raw_notes}}

Generate a formal post-mortem in Markdown:
1. **Executive Summary & Customer Impact:** Downtime percentage, user requests dropped, financial/operational blast radius.
2. **Root Cause Analysis (5 Whys):** Step-by-step causal chain identifying the underlying trigger and systemic weaknesses.
3. **Chronological Incident Timeline:** T0 (trigger) -> Detection -> Escalation -> Mitigation -> Resolution.
4. **What Went Well vs. Where We Got Lucky:** Objective response evaluation.
5. **Action Items Matrix:** Preventive, detective, and mitigative tasks with priority and engineering owners.`
  },
  {
    id: 'report-product-spec-prd',
    title: 'Product Requirements Document (PRD)',
    category: 'creating-reports',
    categoryLabel: 'Creating Reports',
    description:
      'Comprehensive PRD covering problem definition, user stories, non-goals, and success metrics.',
    tags: ['prd', 'product', 'creating-reports', 'planning'],
    body: `Act as a Principal Product Manager. Draft a comprehensive Product Requirements Document (PRD) for the following feature proposal:

**Feature Concept:** {{feature_name}}
**Problem Statement & Target Persona:** {{problem_and_user}}
**Proposed Solution & Constraints:** {{solution_notes}}

Structure the PRD as follows:
1. **Executive Problem Statement:** Why this matters and what friction users experience today.
2. **Success Metrics & KPIs:** Concrete measurable goals (activation, latency, retention, task completion rate).
3. **User Stories & Acceptance Criteria:** Given-When-Then scenarios covering both core and edge-case flows.
4. **Scope Boundaries:** Explicit "In-Scope" vs. "Out-of-Scope (Non-Goals)" definitions.
5. **Technical & UX Requirements:** Performance thresholds, offline capability, security, and accessibility standards.
6. **Open Questions & Risk Assessment:** Technical or user ambiguities to validate prior to engineering kickoff.`
  },
  {
    id: 'report-release-notes-changelog',
    title: 'Customer-Facing Release Notes & Changelog',
    category: 'creating-reports',
    categoryLabel: 'Creating Reports',
    description:
      'Transform git commits and technical tickets into user-friendly, polished release notes.',
    tags: ['release-notes', 'changelog', 'creating-reports'],
    body: `Act as a Technical Product Marketing Lead. Transform the following raw commit messages and engineering tickets into user-facing release notes:

**Version & Release Date:** {{version_and_date}}

**Raw Engineering Commits / Tickets:**
\`\`\`
{{raw_commits}}
\`\`\`

Generate release notes in Keep a Changelog format:
1. **Highlight Banner:** A compelling 2-sentence summary of the flagship improvement in this version.
2. **New Features:** Clear descriptions focusing on user value and productivity gains.
3. **Improvements & Polish:** Performance enhancements, UI responsiveness, and workflow refinements.
4. **Bug Fixes:** Plain-language descriptions of resolved issues without confusing internal jargon.
5. **Breaking Changes & Migration Notes:** Explicit upgrade instructions if applicable.`
  },
  {
    id: 'report-technical-rfc',
    title: 'Technical Design RFC (Request for Comments)',
    category: 'creating-reports',
    categoryLabel: 'Creating Reports',
    description:
      'Draft an architectural RFC evaluating trade-offs, alternative approaches, and migration risks.',
    tags: ['rfc', 'architecture', 'creating-reports'],
    body: `Act as a Software Architect. Write a formal Technical RFC for the proposed engineering initiative:

**RFC Title:** {{rfc_title}}
**Context & Motivation:** {{context}}
**Proposed Approach:** {{proposed_approach}}

Output format:
1. **Summary & Problem Context:** Why the existing system is inadequate.
2. **Detailed Design:** Architecture diagram description, data models, IPC/network protocols, and security boundaries.
3. **Alternative Solutions Considered:** At least 2 alternatives evaluated with pros, cons, and why they were rejected.
4. **Trade-Offs & Complexity:** Operational overhead, compute/storage costs, and failure modes.
5. **Migration & Rollback Plan:** Zero-downtime cutover strategy and canary deployment thresholds.`
  },
  {
    id: 'report-security-compliance-audit',
    title: 'Security Vulnerability & Compliance Report',
    category: 'creating-reports',
    categoryLabel: 'Creating Reports',
    description:
      'Formal security assessment report detailing identified vulnerabilities, CVSS scores, and fixes.',
    tags: ['security', 'compliance', 'creating-reports'],
    body: `Act as an Information Security Officer (CISO). Draft a formal Security Vulnerability Assessment Report based on these audit findings:

**Target Application:** {{app_name}}
**Assessment Scope & Findings:**
{{findings_data}}

Generate a formal audit report:
1. **Assessment Overview & Executive Scorecard:** Overall posture rating (Critical, High, Medium, Low).
2. **Vulnerability Detail Breakdown:** For each finding, list Title, CVSS v3.1 vector, Affected Asset, and Proof of Concept summary.
3. **Exploitability & Business Impact:** What an attacker could achieve if unpatched.
4. **Required Remediation & Verification:** Code or configuration patch required to close the vector.`
  },

  // ==========================================
  // 4. SYSTEM DESIGN & ARCHITECTURE
  // ==========================================
  {
    id: 'system-design-scale-10m',
    title: 'Distributed System Design (10M+ Users)',
    category: 'system-design',
    categoryLabel: 'System Design',
    description:
      'Architect a high-scale distributed system covering caching, partitioning, and resilience.',
    tags: ['system-design', 'distributed-systems', 'scalability'],
    body: `Act as a Principal Infrastructure Architect. Design a distributed, highly available architecture for:

**System Concept:** {{system_concept}}
**Scale Target:** {{scale_target}} (e.g. 10M daily active users, 50k writes/sec)
**Latency & Availability SLAs:** {{slas}}

Provide a detailed system design document:
1. **High-Level Topology:** Client gateway, load balancers, stateless service layers, async queues, and storage.
2. **Data Partitioning & Storage Strategy:** Sharding keys, read replicas, caching tiers (Redis/Memcached), and consistency models (PACELC).
3. **Message Queuing & Event Bus:** Kafka/RabbitMQ event topology, backpressure handling, and consumer concurrency.
4. **Resilience & Fault Tolerance:** Rate limiting (Token Bucket), circuit breakers, dead-letter queues, and multi-region failover.
5. **Cost & Bottleneck Analysis:** Anticipated compute and egress choke points.`
  },
  {
    id: 'system-design-offline-first-desktop',
    title: 'Local-First Desktop Architecture & Sync Strategy',
    category: 'system-design',
    categoryLabel: 'System Design',
    description:
      'Design zero-cloud, privacy-preserving desktop software architecture with SQLite and IPC.',
    tags: ['local-first', 'electron', 'system-design', 'desktop'],
    body: `Act as a Desktop Systems Architect specialized in Electron, SQLite, and local-first software.

Design the architecture for an offline-first desktop application:

**App Goal & Capabilities:**
{{desktop_app_goal}}

**Performance & Platform Constraints:**
- Target OS: Windows / macOS / Linux
- Strict offline requirement: Zero mandatory external API calls
- Data persistence: Local SQLite / local filesystem

Provide:
1. **Process Isolation & IPC Topology:** Main process vs. Preload vs. Sandboxed Renderer communication boundary.
2. **Persistence Schema & WAL Mode:** Local SQLite database structure, vacuum strategy, and write concurrency.
3. **Memory & Resource Management:** Safe handling of large files without exhausting V8 heap limits.
4. **Worker Threading Strategy:** Delegating heavy CPU workloads (media, cryptography, parsing) to Node worker pools.
5. **Security Hardening:** Context isolation, Content Security Policy (CSP), and path traversal prevention.`
  },
  {
    id: 'system-design-api-gateway-migration',
    title: 'Zero-Downtime API Migration & Cutover Strategy',
    category: 'system-design',
    categoryLabel: 'System Design',
    description:
      'Step-by-step Strangler Fig migration plan to replace legacy backends without downtime.',
    tags: ['migration', 'system-design', 'architecture'],
    body: `Act as an Enterprise Enterprise Architect. Design a zero-downtime migration plan using the Strangler Fig pattern to migrate:

**From (Legacy Service):** {{legacy_system}}
**To (New Architecture):** {{new_system}}
**Traffic Volume & SLA:** {{traffic_sla}}

Output:
1. **Routing & Gateway Proxy Layer:** How traffic will be dynamically inspected and split.
2. **Dual-Writing & Shadow-Testing Strategy:** Replaying production read/write requests to verify parity.
3. **Data Backfill & Reconciliation:** Synchronizing historical datasets with automated difference detection.
4. **Canary Phasing & Health Gates:** Percentage rollout stages (1% -> 5% -> 25% -> 100%) and instant abort triggers.`
  },

  // ==========================================
  // 5. WRITING, DEBUGGING & MENTORSHIP
  // ==========================================
  {
    id: 'writing-senior-mentor-explain',
    title: 'Senior Engineer Mentorship & Concept Explainer',
    category: 'writing-review',
    categoryLabel: 'Writing & Review',
    description:
      'Explain difficult technical concepts using concrete analogies, common traps, and mental models.',
    tags: ['mentorship', 'learning', 'writing-review'],
    body: `Act as an empathetic Senior Software Engineering Mentor.

Explain the following advanced concept:
**Concept:** {{technical_concept}}
**Learner Background:** {{learner_background}} (e.g. Junior developer familiar with JavaScript, or frontend dev learning low-level systems)

Structure your explanation:
1. **The Core Intuition:** What fundamental problem does this concept solve? Use a relatable real-world physical analogy.
2. **The 3-Step Mental Model:** How to visualize this mechanism working under the hood.
3. **The Biggest Misconception:** The #1 trap developers fall into when first learning this.
4. **Minimal Concrete Code Example:** A clean, 15-line code sample demonstrating the concept in action.
5. **Quick Self-Check Quiz:** 2 diagnostic questions to verify comprehension.`
  },
  {
    id: 'writing-pull-request-narrative',
    title: 'High-Context Pull Request Description',
    category: 'writing-review',
    categoryLabel: 'Writing & Review',
    description:
      'Craft an exemplary GitHub pull request with context, trade-offs, and verification proof.',
    tags: ['git', 'github', 'pull-request', 'writing-review'],
    body: `Act as a Staff Engineer. Write a comprehensive, high-context GitHub Pull Request description for this change:

**Title & Summary:** {{pr_title}}
**Affected Components:** {{components_affected}}
**Raw Diff or Commit Summary:**
\`\`\`
{{diff_summary}}
\`\`\`

Generate a clean PR description:
1. **Why (Context & Motivation):** The problem this solves and link to related issues.
2. **What (Key Changes):** Bulleted architectural overview of what was added, modified, or deleted.
3. **Trade-offs & Decisions:** Any non-obvious design choices or intentional compromises made.
4. **Verification & Proof:** Exact automated tests run, edge cases tested, and visual/manual verification notes.
5. **Reviewer Checklist:** Specific high-risk areas reviewers should focus on.`
  },
  {
    id: 'writing-minimal-reproducible-example',
    title: 'Minimal Reproducible Example (MRE) Generator',
    category: 'writing-review',
    categoryLabel: 'Writing & Review',
    description:
      'Distill complex, intermittent bugs into standalone minimal test cases for issue tracking.',
    tags: ['debugging', 'reproduction', 'writing-review'],
    body: `Act as a Chromium / Node.js Core Maintainer. Help me strip down the following complex bug into a Minimal Reproducible Example (MRE):

**Observed Bug Behavior:**
{{bug_description}}

**Current Complex Code / Environment:**
\`\`\`{{language}}
{{complex_code}}
\`\`\`

Deliver:
1. **Core Variable Isolation:** What third-party dependencies and peripheral code can be safely removed.
2. **Single-File MRE:** A self-contained, copy-pasteable script (under 40 lines) with zero external setup that reliably triggers the defect.
3. **Expected vs. Actual Output:** Clear terminal output comparisons highlighting the failure.
4. **Environment Matrix:** Instructions on which runtime versions are affected.`
  },
  {
    id: 'writing-readme-documentation',
    title: 'High-Craft Project README & Quickstart Guide',
    category: 'writing-review',
    categoryLabel: 'Writing & Review',
    description:
      'Author an open-source grade README with badges, architecture overview, and clean setup steps.',
    tags: ['documentation', 'readme', 'writing-review'],
    body: `Act as an Open-Source Developer Experience Lead. Write a stunning, professional GitHub \`README.md\` for:

**Project Name:** {{project_name}}
**Tagline & Mission:** {{tagline}}
**Key Features & Differentiators:**
{{features}}

**Installation & Prerequisites:**
{{setup_prerequisites}}

Generate a markdown README featuring:
1. **Hero Header:** Polished project title, badge links, and concise value proposition.
2. **Key Capabilities:** Visual bullet points highlighting performance, local-first privacy, and developer ergonomics.
3. **Quickstart in 60 Seconds:** Copy-paste terminal commands for cloning, configuring, and running locally.
4. **Architecture Overview:** High-level ASCII diagram or flow explaining component interaction.
5. **Contributing & License:** Clean contributor guidelines and standard MIT license attribution.`
  }
]
