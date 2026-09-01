/**
 * Curated Claude Plugins Marketplace Catalog (ADR-0015).
 */

import type { CuratedPlugin } from './types';

export const CURATED_PLUGINS: CuratedPlugin[] = [
  {
    id: 'github-workflow-suite',
    name: 'GitHub Workflow Pro Suite',
    version: '1.2.0',
    description: 'Comprehensive GitHub workflow automation bundle with PR review methodologies, branch managers, issue triage, and GitHub MCP server integration.',
    author: 'Cogito Core Team',
    category: 'development',
    tags: ['github', 'git', 'pr-review', 'collaboration', 'mcp'],
    repository: 'https://github.com/anthropics/claude-code-plugins',
    manifest: {
      name: 'GitHub Workflow Pro Suite',
      version: '1.2.0',
      description: 'Comprehensive GitHub workflow automation bundle with PR reviews and MCP integration.',
      author: 'Cogito Core Team',
      license: 'MIT',
      repository: 'https://github.com/anthropics/claude-code-plugins',
      skills: ['skills/github-pr-reviewer/SKILL.md', 'skills/git-branch-manager/SKILL.md'],
      mcpServers: {
        'github-mcp': {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-github'],
        },
      },
    },
    skills: [
      {
        name: 'github-pr-reviewer',
        description: 'Rigorous Pull Request code review against security, maintainability, breaking changes, and performance standards.',
        skillMd: `---
name: github-pr-reviewer
description: Rigorous Pull Request code review against security, maintainability, breaking changes, and performance standards.
license: MIT
---

# GitHub PR Reviewer Instructions

When reviewing a pull request or code diff:
1. **Architecture & Design:** Check for single-responsibility compliance, clean interfaces, and proper separation of concerns.
2. **Security & Validation:** Inspect inputs, sanitization, token handling, and authorization checks.
3. **Performance & Resource Limits:** Identify N+1 queries, unbounded loops, memory leaks, and missing cleanup hooks.
4. **Breaking Changes:** Verify backwards compatibility for public APIs and database migrations.
5. **Output Format:** Provide clear bulleted findings grouped by severity (Critical, Major, Minor, Nit) followed by a concrete suggested patch.
`,
      },
      {
        name: 'git-branch-manager',
        description: 'Git branching strategy and conflict resolution assistant following GitFlow and Trunk-based development standards.',
        skillMd: `---
name: git-branch-manager
description: Git branching strategy and conflict resolution assistant following GitFlow and Trunk-based development standards.
license: MIT
---

# Git Branch Manager Instructions

1. Assist with semantic branch naming (e.g. \`feat/...\`, \`fix/...\`, \`refactor/...\`).
2. Guide through interactive rebase, cherry-picking, and conflict resolution step-by-step.
3. Provide exact, non-destructive git CLI commands.
`,
      },
    ],
    mcpServers: {
      'github-mcp': {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-github'],
      },
    },
  },
  {
    id: 'security-sentinel',
    name: 'Security Sentinel Suite',
    version: '1.1.0',
    description: 'Enterprise vulnerability assessment, SAST auditing, secret scanning, and automated CVE remediation bundle.',
    author: 'Cogito Security Labs',
    category: 'security',
    tags: ['security', 'cve', 'audit', 'compliance', 'sast'],
    repository: 'https://github.com/anthropics/security-plugins',
    manifest: {
      name: 'Security Sentinel Suite',
      version: '1.1.0',
      description: 'Enterprise vulnerability assessment, SAST auditing, and CVE remediation bundle.',
      author: 'Cogito Security Labs',
      license: 'Apache-2.0',
      skills: ['skills/sast-vulnerability-scanner/SKILL.md', 'skills/cve-remediation-advisor/SKILL.md'],
    },
    skills: [
      {
        name: 'sast-vulnerability-scanner',
        description: 'Static application security testing for OWASP Top 10 vulnerabilities, command injection, XSS, and broken auth.',
        skillMd: `---
name: sast-vulnerability-scanner
description: Static application security testing for OWASP Top 10 vulnerabilities, command injection, XSS, and broken auth.
license: Apache-2.0
---

# SAST Vulnerability Scanner Instructions

Scan code for:
1. **Injection:** SQL, NoSQL, OS Command, Template Injection.
2. **Broken Authentication:** Weak token generation, timing attacks, missing session invalidation.
3. **Data Exposure:** Hardcoded API keys, unencrypted secrets in logs.
4. **Access Control:** Insecure direct object references (IDOR) and missing role verification.
`,
      },
      {
        name: 'cve-remediation-advisor',
        description: 'Advisories and step-by-step upgrade plans for known CVE vulnerabilities in third-party dependencies.',
        skillMd: `---
name: cve-remediation-advisor
description: Advisories and step-by-step upgrade plans for known CVE vulnerabilities in third-party dependencies.
license: Apache-2.0
---

# CVE Remediation Advisor Instructions

1. Identify vulnerable package versions in dependency files (package.json, requirements.txt, go.mod, Cargo.toml).
2. Look up CVSS ratings and affected version bounds.
3. Propose safe minimal version bumps and verify breaking changes in changelogs.
`,
      },
    ],
  },
  {
    id: 'devops-cloud-toolkit',
    name: 'DevOps & Cloud Infrastructure Toolkit',
    version: '2.0.1',
    description: 'Infrastructure as Code (IaC), Docker containerization, Kubernetes orchestration, and CI/CD pipeline automation suite.',
    author: 'CloudOps Collective',
    category: 'devops',
    tags: ['docker', 'kubernetes', 'terraform', 'ci-cd', 'cloud'],
    manifest: {
      name: 'DevOps & Cloud Infrastructure Toolkit',
      version: '2.0.1',
      description: 'Infrastructure as Code, Docker, Kubernetes, and CI/CD automation suite.',
      author: 'CloudOps Collective',
      license: 'MIT',
      skills: ['skills/docker-optimizer/SKILL.md', 'skills/kubernetes-manifest-builder/SKILL.md'],
    },
    skills: [
      {
        name: 'docker-optimizer',
        description: 'Multi-stage Dockerfile architecture, layer caching optimization, and minimal distroless image generation.',
        skillMd: `---
name: docker-optimizer
description: Multi-stage Dockerfile architecture, layer caching optimization, and minimal distroless image generation.
license: MIT
---

# Docker Optimizer Instructions

1. Use multi-stage builds separating build tools from runtime containers.
2. Order Dockerfile instructions by change frequency to maximize layer cache hits.
3. Enforce non-root user execution (\`USER appuser\`).
4. Avoid storing secrets or build caches in production layers.
`,
      },
      {
        name: 'kubernetes-manifest-builder',
        description: 'Production-ready Kubernetes Deployment, Service, Ingress, HPA, and Secret resource generation.',
        skillMd: `---
name: kubernetes-manifest-builder
description: Production-ready Kubernetes Deployment, Service, Ingress, HPA, and Secret resource generation.
license: MIT
---

# Kubernetes Manifest Builder Instructions

1. Configure exact resource requests and limits (\`cpu\`, \`memory\`).
2. Add comprehensive liveness and readiness health probes.
3. Define rolling update deployment strategies with zero downtime.
`,
      },
    ],
  },
  {
    id: 'database-powerpack',
    name: 'Database Architecture & Query Powerpack',
    version: '1.3.0',
    description: 'Database schema design, query plan analysis, indexing strategies, and PostgreSQL / SQLite optimization bundle.',
    author: 'DataScale Engineering',
    category: 'data',
    tags: ['database', 'sql', 'postgres', 'sqlite', 'indexing', 'mcp'],
    manifest: {
      name: 'Database Architecture & Query Powerpack',
      version: '1.3.0',
      description: 'Database schema design, indexing strategies, and PostgreSQL / SQLite optimization bundle.',
      author: 'DataScale Engineering',
      license: 'MIT',
      skills: ['skills/sql-query-optimizer/SKILL.md', 'skills/database-schema-designer/SKILL.md'],
      mcpServers: {
        'postgres-mcp': {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-postgres', 'postgresql://localhost:5432/db'],
        },
      },
    },
    skills: [
      {
        name: 'sql-query-optimizer',
        description: 'Analyze EXPLAIN ANALYZE execution plans, eliminate sequential scans, and design optimal composite indexes.',
        skillMd: `---
name: sql-query-optimizer
description: Analyze EXPLAIN ANALYZE execution plans, eliminate sequential scans, and design optimal composite indexes.
license: MIT
---

# SQL Query Optimizer Instructions

1. Analyze SQL queries for missing indexes, Cartesian products, and improper JOIN conditions.
2. Formulate targeted indexing strategies (B-tree, GIN for JSONB/full-text, BRIN for timeseries).
3. Recommend query rewrites using CTEs, window functions, and partitioning.
`,
      },
      {
        name: 'database-schema-designer',
        description: 'Normalized 3NF relational data modeling, foreign key integrity, and migration scripting.',
        skillMd: `---
name: database-schema-designer
description: Normalized 3NF relational data modeling, foreign key integrity, and migration scripting.
license: MIT
---

# Database Schema Designer Instructions

1. Design schemas ensuring data integrity with strict foreign keys and check constraints.
2. Generate idempotent DDL migration scripts (Up/Down).
3. Plan for non-locking column additions and index creation (\`CONCURRENTLY\`).
`,
      },
    ],
  },
  {
    id: 'fullstack-mastery',
    name: 'Fullstack Next.js & React Mastery',
    version: '2.1.0',
    description: 'Next.js 16 App Router, React 19 Server Components, Tailwind v4 design systems, and state management optimization bundle.',
    author: 'Cogito Frontend Team',
    category: 'development',
    tags: ['react', 'nextjs', 'typescript', 'tailwind', 'frontend'],
    manifest: {
      name: 'Fullstack Next.js & React Mastery',
      version: '2.1.0',
      description: 'Next.js 16, React 19, Tailwind v4, and modern fullstack patterns bundle.',
      author: 'Cogito Frontend Team',
      license: 'MIT',
      skills: ['skills/nextjs-app-router-expert/SKILL.md', 'skills/tailwind-design-system/SKILL.md'],
    },
    skills: [
      {
        name: 'nextjs-app-router-expert',
        description: 'Next.js App Router architecture, Server Components, Route Handlers, and streaming Suspense boundaries.',
        skillMd: `---
name: nextjs-app-router-expert
description: Next.js App Router architecture, Server Components, Route Handlers, and streaming Suspense boundaries.
license: MIT
---

# Next.js App Router Expert Instructions

1. Leverage React Server Components (RSC) for zero-bundle-size server rendering.
2. Keep Client Components (\`"use client"\`) small and leaf-focused.
3. Use streaming with Suspense boundaries for progressive UI loading.
4. Implement secure Route Handlers with explicit validation and status codes.
`,
      },
      {
        name: 'tailwind-design-system',
        description: 'Tailwind CSS v4 design token architecture, theme variables, accessibility, and responsive layouts.',
        skillMd: `---
name: tailwind-design-system
description: Tailwind CSS v4 design token architecture, theme variables, accessibility, and responsive layouts.
license: MIT
---

# Tailwind Design System Instructions

1. Use CSS variable tokens for theme flexibility rather than hardcoding hex values.
2. Build mobile-first, fluid responsive layouts.
3. Ensure high contrast ratios and accessible focus outlines.
`,
      },
    ],
  },
  {
    id: 'qa-testing-pro',
    name: 'QA & Testing Automation Pro',
    version: '1.4.0',
    description: 'Unit testing with Vitest, Integration tests, Playwright E2E automation, and test coverage optimization suite.',
    author: 'TestQuality Alliance',
    category: 'productivity',
    tags: ['testing', 'vitest', 'playwright', 'e2e', 'tdd'],
    manifest: {
      name: 'QA & Testing Automation Pro',
      version: '1.4.0',
      description: 'Vitest, Playwright, and test-driven development workflow suite.',
      author: 'TestQuality Alliance',
      license: 'MIT',
      skills: ['skills/vitest-unit-tester/SKILL.md', 'skills/playwright-e2e-suite/SKILL.md'],
    },
    skills: [
      {
        name: 'vitest-unit-tester',
        description: 'Fast, comprehensive Vitest unit and mock test suite generation with high branch coverage.',
        skillMd: `---
name: vitest-unit-tester
description: Fast, comprehensive Vitest unit and mock test suite generation with high branch coverage.
license: MIT
---

# Vitest Unit Tester Instructions

1. Structure tests with \`describe\`, \`it\`, and \`expect\`.
2. Mock external side-effects (network, file system) cleanly.
3. Test happy paths, boundary edge cases, and explicit error throws.
`,
      },
      {
        name: 'playwright-e2e-suite',
        description: 'End-to-end browser automation tests with resilient locators and visual regression checks.',
        skillMd: `---
name: playwright-e2e-suite
description: End-to-end browser automation tests with resilient locators and visual regression checks.
license: MIT
---

# Playwright E2E Suite Instructions

1. Use user-facing locators (\`getByRole\`, \`getByText\`, \`getByLabel\`).
2. Avoid arbitrary \`waitForTimeout\` sleeps; use web-first assertions.
3. Test key user journeys (auth, CRUD, checkout).
`,
      },
    ],
  },
];
