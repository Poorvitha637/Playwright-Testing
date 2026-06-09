# WebSite Automation Framework

## Technical Design & Implementation Summary

| Field | Detail |
|-------|--------|
| **Project** | WebSite Automation — Broken Link Validation Framework |
| **Technology Stack** | Playwright + TypeScript |
| **Document Type** | Technical Design & Implementation Summary |
| **Audience** | Project Lead / Engineering Leadership |
| **Status** | Phase 1 — Broken Link Validation (Delivered) |
| **Version** | 1.0 |
| **Date** | June 2026 |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Project Objective](#2-project-objective)
3. [Scope of Current Implementation](#3-scope-of-current-implementation)
4. [Framework Architecture](#4-framework-architecture)
5. [Folder Structure](#5-folder-structure)
6. [Component Summary](#6-component-summary)
7. [Execution Workflow](#7-execution-workflow)
8. [Reporting Structure](#8-reporting-structure)
9. [Reusability Design](#9-reusability-design)
10. [Assumptions and Constraints](#10-assumptions-and-constraints)
11. [Phase 1 Deliverables Completed](#11-phase-1-deliverables-completed)
12. [Future Roadmap](#12-future-roadmap)
13. [Benefits to Organization](#13-benefits-to-organization)
14. [Conclusion](#14-conclusion)

---

## 1. Executive Summary

### Purpose of the Framework

The **WebSite Automation** framework is a reusable, configuration-driven test automation solution designed to detect broken hyperlinks across any public website. It combines browser-based crawling with HTTP-level link validation and produces structured reports suitable for QA review, release sign-off, and regression tracking.

### Business Problem Being Solved

Broken links degrade user experience, reduce trust, and negatively impact SEO and conversion. Manual link checking is time-consuming, error-prone, and difficult to repeat consistently across releases, environments, and multiple websites. Teams often discover broken links late — after deployment — when remediation cost is highest.

### Why Automation Is Required

| Challenge | Manual Approach | Automated Approach |
|-----------|-----------------|-------------------|
| Coverage | Limited to sampled pages | Configurable multi-page crawl |
| Consistency | Varies by tester | Same rules every run |
| Speed | Hours to days | Minutes |
| Repeatability | Difficult across releases | On-demand, CI-ready |
| Traceability | Ad hoc notes | JSON + HTML reports with source page context |

### Benefits of Reusable URL-Driven Testing

- **Single configuration point** — users target any website by updating the `.env` file only
- **No per-site scripting** — the same test suite runs against all websites
- **Scalable foundation** — architecture supports future validation modules (images, accessibility, SEO, etc.)
- **Lower total cost of ownership** — one framework, many websites, many validation types over time

---

## 2. Project Objective

| Objective | Status |
|-----------|--------|
| Validate broken links for any website | Achieved |
| User updates only the website URL (via `.env`) | Achieved |
| No code changes required for different websites | Achieved |
| Produce actionable reports for stakeholders | Achieved |
| Support configurable crawl depth | Achieved |

**Primary Goal:** Enable QA and engineering teams to run reliable broken link checks against any website by changing environment configuration — not application code.

---

## 3. Scope of Current Implementation

### What Has Been Implemented

- Playwright + TypeScript automation framework
- Environment-driven configuration via `.env` file
- Configurable website crawling with depth control
- Internal page discovery with duplicate-visit prevention
- Link extraction, filtering, and normalization
- HTTP-based link validation with pass/fail classification
- Dual reporting: JSON and HTML
- Console execution summary with configuration display at startup
- CI-ready Playwright project structure with npm scripts

### What Is Currently Supported

| Capability | Description |
|------------|-------------|
| URL-driven execution | `BASE_URL` read from `.env` |
| Crawl depth control | `CRAWL_DEPTH` (1, 2, 3+) via `.env` |
| Multi-page crawling | Breadth-first crawl of same-domain internal pages |
| Link validation | HTTP status-based PASS/FAIL evaluation |
| Source page tracking | Each link result includes where it was found |
| Report generation | `BrokenLinkReport.json` and `BrokenLinkReport.html` |
| Ignored link types | `mailto:`, `tel:`, `javascript:`, hash-only anchors |
| Pre-execution validation | Framework refuses to run if `BASE_URL` is missing or invalid |

### Current Limitations

- Crawl depth is capped by configuration; unlimited full-site spidering is not the default behavior
- Only anchor (`<a href>`) links are validated — not images, buttons, or embedded resources
- Validation is HTTP status-based; content correctness is not verified
- Sequential link validation — no parallel batching at scale
- Single browser project (Chromium) for crawl execution
- External links are validated but not crawled
- Authentication-gated pages are not supported without future enhancement
- Dynamic/JavaScript-rendered links depend on page load completion at crawl time

---

## 4. Framework Architecture

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USER / CI RUNNER                             │
│                   (.env: BASE_URL, CRAWL_DEPTH)                     │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     TEST EXECUTION LAYER                            │
│                  tests/brokenLinks/brokenLinks.spec.ts              │
│         Orchestrates crawl → validate → report → assert             │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
          ┌─────────────────────┼─────────────────────┐
          ▼                     ▼                     ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐
│  CONFIG LAYER    │  │   CORE LAYER     │  │   UTILITY LAYER      │
│  environment.ts  │  │   BasePage       │  │   LinkCrawler        │
│  (.env loader)   │  │   (navigation)   │  │   LinkExtractor      │
└──────────────────┘  └──────────────────┘  │   LinkValidator      │
                                              │   ReportGenerator    │
                                              └──────────┬───────────┘
                                                         │
                                                         ▼
                                              ┌──────────────────────┐
                                              │   OUTPUT LAYER       │
                                              │   reports/           │
                                              │   JSON + HTML        │
                                              │   Console Summary    │
                                              └──────────────────────┘
```

### Component Interaction Flow

```
.env File
   │
   ▼
Environment Loader ──────────────────────────────┐
   │                                              │
   ▼                                              ▼
Test Execution Layer ──► Link Crawler ──► Base Page
                              │
                              ▼
                        Link Extractor
                              │
                              ▼
                        Link Validator
                              │
                              ▼
                       Report Generator ──► JSON Report
                              │          └─► HTML Report
                              ▼
                       Console Summary
```

### Execution Flow

1. User provides target website URL and crawl depth in `.env`
2. Framework loads and validates configuration at startup
3. Configured URL and crawl depth are displayed before test execution
4. Browser opens the target website
5. Crawler visits internal pages up to configured depth
6. Links are extracted from each crawled page
7. Non-validatable links are filtered out
8. Each discovered link is validated via HTTP request
9. Results are aggregated with status, outcome, and source page
10. JSON and HTML reports are generated
11. Console summary is printed
12. Test fails if any broken links are detected

---

## 5. Folder Structure

| Folder / Path | Purpose |
|---------------|---------|
| **`src/config`** | Central configuration loader. Reads `BASE_URL` and `CRAWL_DEPTH` from `.env` and validates settings before execution. |
| **`src/core`** | Page Object foundation. Provides reusable browser navigation and page-load handling shared across test modules. |
| **`src/models`** | Data contracts and type definitions for link extraction and validation results. Ensures consistent structure across components. |
| **`src/utilities`** | Reusable business logic: crawling, link extraction, HTTP validation, and report generation. Core engine of the framework. |
| **`tests/brokenLinks`** | Test orchestration layer. Drives end-to-end broken link validation without containing business logic directly. |
| **`reports`** | Output directory for generated validation artifacts (`BrokenLinkReport.json`, `BrokenLinkReport.html`). |

### Supporting Project Files

| File | Role |
|------|------|
| `.env` | Active runtime configuration (not committed to source control) |
| `.env.example` | Template for onboarding new users |
| `playwright.config.ts` | Playwright runner configuration |
| `package.json` | Dependency management and npm execution scripts |

---

## 6. Component Summary

| Component | Layer | Responsibility |
|-----------|-------|----------------|
| **Environment Configuration** | Config | Loads `.env` values, validates `BASE_URL`, exposes `crawlDepth`. Ensures framework does not execute with invalid configuration. |
| **Base Page** | Core | Provides standardized navigation and page-load waiting. Abstracts browser interaction for consistent crawl behavior. |
| **Link Crawler** | Utility | Performs breadth-first crawling of same-domain internal pages. Maintains visited URL set to prevent duplicate visits. Respects configured crawl depth. |
| **Link Extractor** | Utility | Collects anchor links from each page. Filters invalid/non-HTTP links. Resolves relative URLs. Associates each link with its source page. |
| **Link Validator** | Utility | Sends HTTP requests to each discovered link. Captures response status. Classifies each link as PASS or FAIL based on defined status code rules. |
| **Report Generator** | Utility | Produces JSON and HTML reports with crawl metadata, summary statistics, and detailed per-link results. |
| **Test Execution Layer** | Test | Coordinates the full workflow: configuration display → crawl → validate → report → summary → assertion. Contains no website-specific logic. |

### Design Principles Applied

- **Separation of concerns** — configuration, core browser behavior, utilities, and tests are isolated
- **Page Object pattern** — browser interactions centralized in `BasePage`
- **Utility pattern** — reusable, single-responsibility modules
- **Configuration over code** — website targeting via environment variables
- **Generic by design** — no hardcoded website dependencies

---

## 7. Execution Workflow

### Step-by-Step Process

| Step | Activity | Output |
|------|----------|--------|
| 1 | User sets `BASE_URL` and `CRAWL_DEPTH` in `.env` | Target configuration |
| 2 | User runs `npm run test:broken-links` | Test execution begins |
| 3 | Framework validates configuration | Startup config displayed in console |
| 4 | Browser navigates to target website | Homepage loaded |
| 5 | Crawler discovers internal pages per depth setting | List of crawled pages |
| 6 | Link Extractor collects links from each crawled page | Discovered link inventory |
| 7 | Invalid link types are excluded | Clean validation candidate list |
| 8 | Link Validator checks each URL via HTTP | PASS/FAIL results with status codes |
| 9 | Report Generator writes JSON and HTML reports | `reports/BrokenLinkReport.*` |
| 10 | Console summary printed | Human-readable execution overview |
| 11 | Test assertion applied | Pass if zero failures; fail otherwise |

### Crawl Depth Behavior

| `CRAWL_DEPTH` | Coverage |
|---------------|----------|
| 1 | Homepage only |
| 2 | Homepage + first-level internal pages |
| 3 | Homepage + two additional internal levels |

---

## 8. Reporting Structure

### JSON Report (`BrokenLinkReport.json`)

Machine-readable report for tooling, CI integration, and archival.

**Includes:**

- Generation timestamp
- Target `baseUrl` and `crawlDepth`
- Total pages crawled
- Total links checked
- Passed and failed counts
- Full list of crawled pages
- Per-link detail: URL, HTTP status, PASS/FAIL result, source page

### HTML Report (`BrokenLinkReport.html`)

Human-readable report for QA leads, project managers, and stakeholders.

**Includes:**

- Summary dashboard (pages crawled, links checked, passed, failed)
- List of all crawled pages
- Results table with URL, status code, result, and source page
- Visual pass/fail distinction for quick review

### Execution Summary (Console)

Printed at two points during execution:

1. **Startup** — configured `BASE_URL` and `CRAWL_DEPTH`
2. **Completion** — pages crawled, links checked, pass/fail counts, report file paths

### Failure Reporting

When broken links are detected:

- Failed links listed in console with status code, URL, and source page
- Failures captured in both JSON and HTML reports
- Test run marked as **failed** to support CI/CD gating

### Pass / Fail Classification

| Result | HTTP Status Codes |
|--------|-------------------|
| **PASS** | 200, 201, 202, 301, 302 |
| **FAIL** | 400, 401, 403, 404, 500, 503, network errors, and unclassified codes |

---

## 9. Reusability Design

### How the Framework Supports Multiple Websites

The framework is intentionally **website-agnostic**. No test logic, utility logic, or report structure is tied to a specific domain.

| User Action | Required? |
|-------------|-----------|
| Update `BASE_URL` in `.env` | Yes |
| Optionally adjust `CRAWL_DEPTH` | As needed |
| Modify source code | No |
| Create new test files per website | No |
| Change validation rules per site | No |

### Reusability Enablers

- **Centralized configuration** — all runtime targeting via `.env`
- **Generic crawl engine** — domain derived dynamically from `BASE_URL`
- **Normalized URL handling** — supports relative and absolute links
- **Modular utilities** — components usable by future validation modules
- **Standardized reporting** — consistent output format regardless of target site

### Example Usage Scenarios

| Scenario | Configuration Change |
|----------|---------------------|
| New client website | Update `BASE_URL` only |
| Deeper site scan | Increase `CRAWL_DEPTH` |
| Pre-release regression | Re-run same command |
| CI pipeline execution | Inject `BASE_URL` as environment variable |

---

## 10. Assumptions and Constraints

### Current Assumptions

- Target websites are publicly accessible without authentication
- Links are discoverable via standard HTML anchor elements
- HTTP response status codes are a sufficient indicator of link health
- Same-domain pages share a consistent hostname
- Playwright Chromium browser is available in the execution environment
- `.env` file is present and correctly configured before execution

### Current Constraints

- Anchor links only — no image `src`, script, or stylesheet validation
- Crawl depth is finite and user-configured
- Sequential validation may be slow on very large sites
- Sites with aggressive bot protection may produce inconsistent results
- JavaScript-heavy SPAs may require additional wait strategies in future phases
- No built-in scheduling — execution is on-demand or CI-triggered

### Future Improvements

- Parallel link validation for large sites
- Authentication and session support
- Sitemap-based crawling as an alternative to depth-based crawl
- Configurable pass/fail status code rules via `.env`
- Email or Slack notification on failure
- Historical trend reporting across runs
- Integration with Allure or other enterprise reporting

---

## 11. Phase 1 Deliverables Completed

| # | Deliverable | Status |
|---|-------------|--------|
| 1 | Playwright + TypeScript framework scaffold | Complete |
| 2 | Modular folder structure (`config`, `core`, `models`, `utilities`, `tests`, `reports`) | Complete |
| 3 | Environment-driven configuration via `.env` | Complete |
| 4 | `BASE_URL` validation before execution | Complete |
| 5 | Configurable crawl depth (`CRAWL_DEPTH`) | Complete |
| 6 | Multi-page BFS crawling with visited URL tracking | Complete |
| 7 | Link extraction with filtering (`mailto`, `tel`, `javascript`, hash) | Complete |
| 8 | HTTP-based link validation with PASS/FAIL rules | Complete |
| 9 | Source page tracking per link | Complete |
| 10 | JSON report generation | Complete |
| 11 | HTML report generation | Complete |
| 12 | Console configuration and execution summary | Complete |
| 13 | npm scripts for test execution | Complete |
| 14 | CI workflow scaffold (GitHub Actions) | Complete |
| 15 | Verified execution against sample website | Complete |

---

## 12. Future Roadmap

### Phase 1 Remaining

| Module | Description |
|--------|-------------|
| **Image Validation** | Verify image URLs resolve and return valid responses |
| **ALT Text Validation** | Ensure images contain appropriate accessibility alt attributes |
| **Content Validation** | Validate expected text/content presence on pages |
| **Button Validation** | Verify button elements are functional and navigable |

### Phase 2 — Visual Design Compliance

| Module | Description |
|--------|-------------|
| **Font Validation** | Verify typography matches design standards |
| **Color Validation** | Validate color usage against brand guidelines |
| **Spacing Validation** | Check layout spacing against design specifications |

### Phase 3 — Responsive & Visual Quality

| Module | Description |
|--------|-------------|
| **Responsive Validation** | Verify layout behavior across viewport sizes |
| **Visual Regression** | Detect unintended UI changes between releases |
| **Figma Comparison** | Compare rendered UI against Figma design specifications |

### Phase 4 — Accessibility, SEO & Performance

| Module | Description |
|--------|-------------|
| **Accessibility** | WCAG compliance checks (ARIA, contrast, keyboard navigation) |
| **SEO** | Meta tags, heading structure, canonical URLs, indexability |
| **Lighthouse Performance** | Core Web Vitals and performance scoring |

### Roadmap Summary

```
Phase 1 (Current)     → Broken Links ✅  |  Images, ALT, Content, Buttons (Remaining)
Phase 2               → Font, Color, Spacing Validation
Phase 3               → Responsive, Visual Regression, Figma Comparison
Phase 4               → Accessibility, SEO, Lighthouse Performance
```

---

## 13. Benefits to Organization

### QA Efficiency Improvements

- Eliminates repetitive manual link checking across pages and releases
- Provides consistent, auditable validation methodology
- Reduces human error in large-scale website reviews

### Reduced Manual Effort

- One command validates an entire configured site section
- Reports are auto-generated — no manual log compilation
- Failed links include source page context for faster defect triage

### Faster Regression Testing

- Re-runnable before every release, deployment, or content update
- Suitable for integration into CI/CD pipelines
- Immediate feedback on link health post-deployment

### Reusable Automation Asset

- Single framework serves multiple websites and projects
- Extensible architecture supports long-term QA automation strategy
- Low onboarding cost — new team members need only update `.env`

### Quantifiable Value

| Metric | Expected Impact |
|--------|----------------|
| Manual testing time | Significant reduction for link validation cycles |
| Defect detection | Earlier identification of broken links |
| Release confidence | Higher through automated pre-release checks |
| Maintenance cost | Lower — one framework vs. per-site scripts |

---

## 14. Conclusion

The **WebSite Automation — Broken Link Validation Framework** delivers a production-ready, reusable automation foundation that addresses a common and high-impact quality risk: broken hyperlinks.

The framework achieves its core design goals:

- **URL-driven** — any website targeted via `.env` configuration
- **Code-free reuse** — no per-website scripting required
- **Architecturally sound** — modular, layered, and extensible
- **Operationally useful** — dual reports, console summaries, and CI readiness

Phase 1 broken link validation is **complete and verified**. The architecture is intentionally designed to support the broader WebSite Automation roadmap — from content and image validation through visual compliance, accessibility, and performance — making this a strategic long-term automation asset rather than a one-time test script.

**Recommendation:** Approve Phase 1 delivery and plan Phase 1 remaining items (Image, ALT Text, Content, and Button Validation) as the next sprint priority, leveraging the existing framework structure without architectural rework.

---

*Document prepared for Project Lead review. Reflects the current state of the WebSite Automation workspace as implemented.*

**End of Document**
