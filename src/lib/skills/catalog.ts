/**
 * Curated Claude & Agent Skills Catalog (ADR-0013).
 *
 * Pre-packaged, high-quality skills ready for 1-click installation.
 */

import type { CuratedSkill } from "./types";

export const CURATED_SKILLS: CuratedSkill[] = [
  {
    id: "code-reviewer",
    name: "code-reviewer",
    description: "Perform comprehensive, senior-level code reviews analyzing bugs, security vulnerabilities, edge cases, performance, and best practices.",
    category: "Review",
    author: "Cogito Team",
    tags: ["review", "quality", "security", "best-practices"],
    skillMd: `---
name: code-reviewer
description: Perform comprehensive, senior-level code reviews analyzing bugs, security vulnerabilities, edge cases, performance, and best practices.
license: MIT
metadata:
  version: "1.0.0"
  category: "Code Quality"
---

# Senior Code Reviewer Skill

You act as a Principal Software Engineer and Staff Security Reviewer. When presented with code, diffs, or architecture designs, conduct a rigorous, constructive review.

## Review Dimensions

1. **Correctness & Logic Flaws**:
   - Off-by-one errors, null/undefined dereferences, race conditions, async/await pitfalls.
   - Unhandled error cases and broken invariants.

2. **Security & Vulnerabilities**:
   - Injection vulnerabilities (SQL, command, XSS, SSRF).
   - Insecure deserialization, credential leakage, broken access controls.

3. **Performance & Resource Utilization**:
   - Unnecessary database queries (N+1), memory leaks, unbounded cache growth.
   - Algorithmic complexity ($O(N^2)$ loops where $O(N)$ is possible).

4. **Maintainability & Idiomatic Design**:
   - Adherence to language idioms and established patterns.
   - Separation of concerns and clear naming.

## Output Format
- **Summary**: 1-2 sentence high-level assessment.
- **Critical Issues** (if any): Bugs or security risks with exact line numbers and concrete remediation code.
- **Suggestions & Improvements**: Performance, typing, readability recommendations.
- **Refactored Code**: Drop-in improved snippet if applicable.
`,
  },
  {
    id: "commit-message-generator",
    name: "commit-message-generator",
    description: "Generate clean, standardized git commit messages following the Conventional Commits 1.0 specification.",
    category: "Productivity",
    author: "Cogito Team",
    tags: ["git", "commits", "conventional-commits", "workflow"],
    skillMd: `---
name: commit-message-generator
description: Generate clean, standardized git commit messages following the Conventional Commits 1.0 specification.
license: MIT
metadata:
  version: "1.0.0"
---

# Conventional Commit Message Generator

Generate standard git commit messages following the Conventional Commits 1.0 specification:
\`<type>(<optional scope>): <description>\`

## Commit Types
- **feat**: A new feature for the user
- **fix**: A bug fix
- **docs**: Documentation only changes
- **style**: Changes that do not affect the meaning of the code (formatting, missing semi-colons)
- **refactor**: A code change that neither fixes a bug nor adds a feature
- **perf**: A code change that improves performance
- **test**: Adding missing tests or correcting existing tests
- **chore**: Changes to the build process, auxiliary tools, or dependency updates

## Guidelines
1. Use imperative mood in the title ("add", not "added" or "adds").
2. Limit the subject line to 72 characters.
3. If breaking changes exist, include \`BREAKING CHANGE:\` in the footer.
4. When given git diffs or file summaries, identify the primary motivation and generate 1 recommended primary message and 2 alternative concise options.
`,
  },
  {
    id: "consolidate-deps",
    name: "consolidate-deps",
    description: "Consolidate scattered weekly dependency bumps and Dependabot updates into unified, verified update manifests.",
    category: "Development",
    author: "Cogito Team",
    tags: ["dependencies", "npm", "dependabot", "maintenance"],
    skillMd: `---
name: consolidate-deps
description: Consolidate scattered weekly dependency bumps and Dependabot updates into unified, verified update manifests.
license: MIT
metadata:
  version: "1.0.0"
---

# Consolidate Dependencies Workflow

Consolidate automated dependency updates into a single PR with verified stability.

## Procedure
1. **Group by Risk Tier**:
   - **Patch & Minor updates**: Consolidate directly after running test suite.
   - **Major updates**: Verify peer dependency matrix, check changelogs for breaking changes.
   - **Toolchain / Engine updates**: Defer if breaking peer ranges (e.g. ESLint/TS).

2. **Changelog Construction**:
   - List every package bumped with \`old_version -> new_version\`.
   - Highlight any API deprecations or configuration shifts.
   - Note validation status (\`npm run test\` and \`npm run build\`).
`,
  },
  {
    id: "security-auditor",
    name: "security-auditor",
    description: "Perform in-depth application security audits inspecting CVEs, OWASP Top 10 vulnerabilities, authorization flaws, and cryptographic weaknesses.",
    category: "Security",
    author: "Cogito Team",
    tags: ["security", "cve", "owasp", "audit", "pentest"],
    skillMd: `---
name: security-auditor
description: Perform in-depth application security audits inspecting CVEs, OWASP Top 10 vulnerabilities, authorization flaws, and cryptographic weaknesses.
license: MIT
metadata:
  version: "1.0.0"
---

# Application Security Auditor

Conduct authoritative threat modeling and vulnerability auditing for web applications, APIs, smart contracts, and microservices.

## Audit Checklist
1. **Injection & Input Validation**: SQLi, NoSQLi, OS Command Injection, SSTI, Path Traversal.
2. **Authentication & Session Management**: Weak JWT secrets, missing rotation, session fixation, timing attacks.
3. **Broken Object Level Authorization (BOLA/IDOR)**: Missing tenant isolation, unverified user IDs.
4. **Cryptographic Integrity**: Weak algorithms (MD5/SHA1), hardcoded secrets, insecure RNG.
5. **Supply Chain & Dependencies**: Known CVEs in third-party libraries.

## Output Structure
- **Vulnerability Title & CVSS 3.1 Severity** (Critical / High / Medium / Low).
- **Proof of Concept (PoC) / Exploit Vector**: How an attacker could exploit it.
- **Root Cause Analysis**: The underlying vulnerable code mechanism.
- **Remediation**: Exact, hardened code replacement and defensive architecture recommendations.
`,
  },
  {
    id: "doc-generator",
    name: "doc-generator",
    description: "Generate clean, exhaustive technical documentation, READMEs, architectural decision records (ADRs), and JSDoc/TSDoc specifications.",
    category: "Productivity",
    author: "Cogito Team",
    tags: ["docs", "jsdoc", "adr", "architecture", "markdown"],
    skillMd: `---
name: doc-generator
description: Generate clean, exhaustive technical documentation, READMEs, architectural decision records (ADRs), and JSDoc/TSDoc specifications.
license: MIT
metadata:
  version: "1.0.0"
---

# Technical Documentation & ADR Generator

Transform complex codebases and architectural designs into clear, structured documentation.

## Standards
- **ADRs (Architectural Decision Records)**:
  - Context & Problem Statement
  - Decision Drivers
  - Considered Options (with pros/cons)
  - Decision Outcome & Consequences
- **API Reference**:
  - Request/Response schemas with exact types
  - Status codes, error handling contracts, and example payloads
- **JSDoc/TSDoc**:
  - \`@param\`, \`@returns\`, \`@throws\`, \`@example\` for exported functions and types
`,
  },
  {
    id: "refactor-clean-code",
    name: "refactor-clean-code",
    description: "Refactor messy, monolithic, or duplicate code into modular, maintainable, SOLID architecture with zero behavioral regression.",
    category: "Architecture",
    author: "Cogito Team",
    tags: ["refactor", "solid", "clean-code", "modularity"],
    skillMd: `---
name: refactor-clean-code
description: Refactor messy, monolithic, or duplicate code into modular, maintainable, SOLID architecture with zero behavioral regression.
license: MIT
metadata:
  version: "1.0.0"
---

# Clean Code & SOLID Refactoring Skill

Refactor existing implementations to maximize readability, maintainability, and testability while guaranteeing zero breaking changes.

## Core Rules
1. **Single Responsibility Principle (SRP)**: Split bloated files and multi-purpose functions.
2. **Open/Closed Principle**: Favor composition, strategies, and registry patterns over branching \`switch\` statements.
3. **DRY & Decomposition**: Extract repeated logic into reusable utility functions.
4. **Preserve External Interface**: Maintain exact function signatures and exported contracts unless a breaking change is explicitly requested.
5. **Provide Explanatory Diffs**: Clearly explain why each transformation enhances code quality.
`,
  },
  {
    id: "test-engineer",
    name: "test-engineer",
    description: "Generate thorough, robust unit tests, integration tests, and edge case coverage across Vitest, Jest, PyTest, or Playwright.",
    category: "Testing",
    author: "Cogito Team",
    tags: ["testing", "vitest", "jest", "pytest", "tdd"],
    skillMd: `---
name: test-engineer
description: Generate thorough, robust unit tests, integration tests, and edge case coverage across Vitest, Jest, PyTest, or Playwright.
license: MIT
metadata:
  version: "1.0.0"
---

# Senior Test Engineer Skill

Author comprehensive, self-contained test suites following testing best practices (Arrange-Act-Assert, TDD).

## Test Strategy
1. **Happy Path**: Expected inputs and standard flows.
2. **Boundary & Edge Cases**:
   - Zero, null, undefined, empty strings, max int, NaN.
   - Empty collections, massive inputs, special characters, unicode.
3. **Error Paths & Exceptions**:
   - Network failure, timeout, malformed payload, permission denied.
4. **Mocking & Isolation**:
   - Mock external I/O (files, network, databases) cleanly without over-mocking internal logic.
`,
  },
  {
    id: "prompt-optimizer",
    name: "prompt-optimizer",
    description: "Analyze, refine, and optimize system prompts, agent instructions, and few-shot examples for maximum LLM adherence and performance.",
    category: "Prompting",
    author: "Cogito Team",
    tags: ["prompt", "llm", "system-prompt", "meta-prompt"],
    skillMd: `---
name: prompt-optimizer
description: Analyze, refine, and optimize system prompts, agent instructions, and few-shot examples for maximum LLM adherence and performance.
license: MIT
metadata:
  version: "1.0.0"
---

# Prompt Optimizer & System Architect

Refine system prompts and agent directives for maximum instruction-following fidelity, minimal hallucination, and concise execution.

## Optimization Principles
1. **Role & Epistemic Frame**: Explicitly specify competence level, domain authority, and uncertainty handling.
2. **Structural Scaffolding**: Use clear XML or Markdown headers for instructions, constraints, and output schema.
3. **Negative Constraints & Invariants**: Clearly declare what NOT to do (e.g. "Do not narrate tool calls").
4. **Few-Shot Demonstration**: Provide realistic input/output pairs for complex formatting.
`,
  },
  {
    id: "api-designer",
    name: "api-designer",
    description: "Design robust, scalable REST and GraphQL APIs following OpenAPI 3.1 specifications, RESTful conventions, and error handling contracts.",
    category: "Architecture",
    author: "Cogito Team",
    tags: ["api", "rest", "graphql", "openapi", "design"],
    skillMd: `---
name: api-designer
description: Design robust, scalable REST and GraphQL APIs following OpenAPI 3.1 specifications, RESTful conventions, and error handling contracts.
license: MIT
metadata:
  version: "1.0.0"
---

# API Designer & Architect

Design resilient, idiomatic, backward-compatible API contracts.

## Standards
- **Resource URIs**: Plural nouns (\`/api/projects\`, \`/api/projects/{id}/documents\`).
- **HTTP Methods**: GET (read-only), POST (create/action), PUT (replace), PATCH (partial update), DELETE (remove).
- **Status Codes**: 200 OK, 201 Created, 204 No Content, 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 409 Conflict, 422 Unprocessable Entity, 500 Internal Error.
- **Error Payloads**: Standardized \`{ error: string, code?: string, details?: any }\`.
- **Pagination & Filtering**: Standardized cursor/offset schemas with \`limit\` and \`next_cursor\`.
`,
  },
  {
    id: "regex-master",
    name: "regex-master",
    description: "Construct, explain, test, and optimize regular expressions with comprehensive edge-case safety and catastrophic backtracking prevention.",
    category: "Productivity",
    author: "Cogito Team",
    tags: ["regex", "parsing", "pattern", "optimization"],
    skillMd: `---
name: regex-master
description: Construct, explain, test, and optimize regular expressions with comprehensive edge-case safety and catastrophic backtracking prevention.
license: MIT
metadata:
  version: "1.0.0"
---

# Regular Expression Master

Construct robust, high-performance regex patterns with zero ReDoS (Regular Expression Denial of Service) risk.

## Delivery Format
1. **Regex Pattern**: Clearly highlighted with relevant flags (e.g. \`g\`, \`i\`, \`m\`, \`s\`, \`u\`).
2. **Component Breakdown**: Line-by-line explanation of groups, lookarounds, and quantifiers.
3. **Test Cases**: Table of matching and non-matching test strings.
4. **Language Implementation**: Code snippets for TypeScript, Python, or Go.
`,
  },
];
