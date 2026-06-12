# Playwright Automation Testing Framework

## Overview

This project is an automation testing framework built using Playwright and TypeScript. It focuses on validating website quality through automated checks and reporting.

## Features

* Automated Broken Link Validation
* Automated Image Validation
* HTML Test Reports
* Environment-based Configuration
* Reusable Utility Functions
* Playwright Test Runner Integration

## Project Structure

```text
├── tests/
│   ├── brokenLinks/
│   └── imageValidation/
├── src/
│   ├── config/
│   ├── models/
│   ├── utilities/
│   └── core/
├── reports/
├── playwright-report/
├── .env
├── playwright.config.ts
└── package.json
```

## Implemented Test Modules

### Broken Link Validation

Validates website links and identifies:

* Broken URLs
* Invalid redirects
* Non-responsive links
* HTTP error responses (4xx, 5xx)

### Image Validation

Validates website images by checking:

* Image availability
* Broken image sources
* HTTP response status
* Missing or inaccessible image resources

## Prerequisites

* Node.js
* npm
* Playwright

## Installation

```bash
npm install
```

## Configuration

Create a `.env` file and configure:

```env
BASE_URL=https://your-website-url.com
```

## Running Tests

Run all tests:

```bash
npx playwright test
```

Run a specific test:

```bash
npx playwright test tests/brokenLinks
```

## Reports

Generate and view Playwright reports:

```bash
npx playwright show-report
```

## Technologies Used

* Playwright
* TypeScript
* Node.js
* HTML Reporting


QA Automation Intern

