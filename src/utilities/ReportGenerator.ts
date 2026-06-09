/**
 * ReportGenerator.ts
 *
 * Utility for persisting broken link validation results as JSON and HTML reports.
 */

import * as fs from 'fs';
import * as path from 'path';
import { DiscoveryMethod, LinkResult } from '../models/LinkResult';
import { getExternalFailures, getInternalFailures } from './LinkValidator';

const REPORT_DIR = path.resolve(process.cwd(), 'reports');
const JSON_REPORT_FILE = path.join(REPORT_DIR, 'BrokenLinkReport.json');
const HTML_REPORT_FILE = path.join(REPORT_DIR, 'BrokenLinkReport.html');
const FAILED_LINKS_LOG_FILE = path.join(REPORT_DIR, 'failed-links.log');
const FAILED_LINKS_HTML_FILE = path.join(REPORT_DIR, 'failed-links.html');

/** Summary metadata included at the top of every report. */
export interface BrokenLinkReport {
  generatedAt: string;
  baseUrl: string;
  discoveryMethod: DiscoveryMethod;
  totalPagesCrawled: number;
  totalLinksValidated: number;
  passed: number;
  failed: number;
  internalFailed: number;
  externalFailed: number;
  crawlTimedOut: boolean;
  crawlDurationMs: number;
  pagesCrawled: string[];
  results: LinkResult[];
}

export interface ReportPaths {
  jsonPath: string;
  htmlPath: string;
  failedLinksLogPath: string;
  failedLinksHtmlPath: string;
}

export interface ReportOptions {
  baseUrl: string;
  discoveryMethod: DiscoveryMethod;
  pagesCrawled: string[];
  timedOut: boolean;
  crawlDurationMs: number;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

function buildReport(results: LinkResult[], options: ReportOptions): BrokenLinkReport {
  const passed = results.filter((r) => r.result === 'PASS').length;
  const failed = results.filter((r) => r.result === 'FAIL').length;
  const internalFailed = getInternalFailures(results).length;
  const externalFailed = getExternalFailures(results).length;

  return {
    generatedAt: new Date().toISOString(),
    baseUrl: options.baseUrl,
    discoveryMethod: options.discoveryMethod,
    totalPagesCrawled: options.pagesCrawled.length,
    totalLinksValidated: results.length,
    passed,
    failed,
    internalFailed,
    externalFailed,
    crawlTimedOut: options.timedOut,
    crawlDurationMs: options.crawlDurationMs,
    pagesCrawled: options.pagesCrawled,
    results,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatFailedLinkEntry(r: LinkResult, index: number): string[] {
  const lines = [
    `${index}. [${r.status}] ${r.url}`,
    `   Type       : ${r.linkType.toUpperCase()}`,
    `   Link Text  : ${r.linkText || '(no text)'}`,
    `   Source Page: ${r.sourcePageTitle || r.sourcePage}`,
    `   Source URL : ${r.sourcePage}`,
  ];

  if (r.sourcePages.length > 1) {
    lines.push(`   Also on    : ${r.sourcePages.slice(1).join(', ')}`);
  }

  lines.push('');
  return lines;
}

function buildHtmlContent(report: BrokenLinkReport): string {
  const rows = report.results
    .map((r) => {
      const rowClass =
        r.result === 'FAIL' && r.linkType === 'internal'
          ? 'fail'
          : r.result === 'FAIL' && r.linkType === 'external'
            ? 'external-fail'
            : 'pass';

      return `
        <tr class="${rowClass}">
          <td>${r.linkType}</td>
          <td>${escapeHtml(r.url)}</td>
          <td>${r.status}</td>
          <td class="result-${r.result.toLowerCase()}">${r.result}</td>
          <td>${escapeHtml(r.linkText || '—')}</td>
          <td>${escapeHtml(r.sourcePageTitle || r.sourcePage)}</td>
          <td title="${escapeHtml(r.sourcePage)}">${escapeHtml(r.sourcePage)}</td>
        </tr>`;
    })
    .join('');

  const pageList = report.pagesCrawled
    .map((p) => `<li>${escapeHtml(p)}</li>`)
    .join('');

  const timeoutNote = report.crawlTimedOut
    ? ' &nbsp;|&nbsp; <strong style="color:#dc2626">Discovery timed out</strong>'
    : '';

  const methodLabel =
    report.discoveryMethod === 'sitemap'
      ? 'Sitemap'
      : report.discoveryMethod === 'http-crawl'
        ? 'HTTP Crawl'
        : 'Playwright Fallback';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Broken Link Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f4f6f9; color: #1a1a2e; padding: 2rem; }
    h1 { font-size: 1.6rem; margin-bottom: 0.25rem; }
    .subtitle { color: #6b7280; margin-bottom: 1.5rem; font-size: 0.9rem; }
    .cards { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.5rem; }
    .card { background: #fff; border-radius: 8px; padding: 1rem 1.5rem; box-shadow: 0 1px 4px rgba(0,0,0,.08); min-width: 140px; }
    .card .label { font-size: 0.75rem; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; }
    .card .value { font-size: 1.8rem; font-weight: 700; margin-top: 0.25rem; }
    .card.pass .value { color: #16a34a; }
    .card.fail .value { color: #dc2626; }
    .card.warn .value { color: #d97706; }
    section { background: #fff; border-radius: 8px; padding: 1.5rem; box-shadow: 0 1px 4px rgba(0,0,0,.08); margin-bottom: 1.5rem; }
    section h2 { font-size: 1rem; margin-bottom: 0.75rem; color: #374151; }
    table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    th { background: #f9fafb; text-align: left; padding: 0.6rem 0.75rem; border-bottom: 2px solid #e5e7eb; color: #374151; }
    td { padding: 0.55rem 0.75rem; border-bottom: 1px solid #f3f4f6; word-break: break-all; }
    tr.fail td { background: #fef2f2; }
    tr.external-fail td { background: #fff7ed; }
    tr.pass td { background: #f0fdf4; }
    .result-pass { color: #16a34a; font-weight: 600; }
    .result-fail { color: #dc2626; font-weight: 600; }
    ul { padding-left: 1.25rem; font-size: 0.85rem; }
    ul li { margin-bottom: 0.3rem; word-break: break-all; }
  </style>
</head>
<body>
  <h1>Broken Link Validation Report</h1>
  <p class="subtitle">Generated: ${escapeHtml(report.generatedAt)} &nbsp;|&nbsp; Site: ${escapeHtml(report.baseUrl)} &nbsp;|&nbsp; Discovery: ${methodLabel} &nbsp;|&nbsp; Duration: ${formatDuration(report.crawlDurationMs)}${timeoutNote}</p>

  <div class="cards">
    <div class="card"><div class="label">Pages Crawled</div><div class="value">${report.totalPagesCrawled}</div></div>
    <div class="card"><div class="label">Links Validated</div><div class="value">${report.totalLinksValidated}</div></div>
    <div class="card pass"><div class="label">Passed</div><div class="value">${report.passed}</div></div>
    <div class="card fail"><div class="label">Internal Failed</div><div class="value">${report.internalFailed}</div></div>
    <div class="card warn"><div class="label">External Failed</div><div class="value">${report.externalFailed}</div></div>
  </div>

  <section>
    <h2>Pages Crawled</h2>
    <ul>${pageList}</ul>
  </section>

  <section>
    <h2>Link Validation Results</h2>
    <table>
      <thead>
        <tr>
          <th>Type</th>
          <th>URL</th>
          <th>Status</th>
          <th>Result</th>
          <th>Link Text</th>
          <th>Source Page</th>
          <th>Source URL</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </section>
</body>
</html>`;
}

export async function generateJsonReport(
  results: LinkResult[],
  options: ReportOptions
): Promise<string> {
  const report = buildReport(results, options);

  await fs.promises.mkdir(REPORT_DIR, { recursive: true });
  await fs.promises.writeFile(JSON_REPORT_FILE, JSON.stringify(report, null, 2), 'utf-8');

  return JSON_REPORT_FILE;
}

export async function generateHtmlReport(
  results: LinkResult[],
  options: ReportOptions
): Promise<string> {
  const report = buildReport(results, options);
  const html = buildHtmlContent(report);

  await fs.promises.mkdir(REPORT_DIR, { recursive: true });
  await fs.promises.writeFile(HTML_REPORT_FILE, html, 'utf-8');

  return HTML_REPORT_FILE;
}

/**
 * Writes failed links to reports/failed-links.log.
 * Internal failures are listed first (test fails on these).
 * External failures are listed separately for reference.
 */
export async function generateFailedLinksLog(results: LinkResult[]): Promise<string> {
  const internalFailed = getInternalFailures(results);
  const externalFailed = getExternalFailures(results);
  const generatedAt = new Date().toISOString();

  const lines = [
    'Broken Link Validation — Failed Links Log',
    `Generated: ${generatedAt}`,
    `Internal Failed: ${internalFailed.length} (test fails on these)`,
    `External Failed: ${externalFailed.length} (informational only)`,
    '',
    '=== INTERNAL FAILURES (action required) ===',
    '',
  ];

  if (internalFailed.length === 0) {
    lines.push('No internal broken links found.', '');
  } else {
    internalFailed.forEach((r, index) => {
      lines.push(...formatFailedLinkEntry(r, index + 1));
    });
  }

  lines.push('=== EXTERNAL FAILURES (informational) ===', '');

  if (externalFailed.length === 0) {
    lines.push('No external link failures.', '');
  } else {
    externalFailed.forEach((r, index) => {
      lines.push(...formatFailedLinkEntry(r, index + 1));
    });
  }

  await fs.promises.mkdir(REPORT_DIR, { recursive: true });
  await fs.promises.writeFile(FAILED_LINKS_LOG_FILE, lines.join('\n'), 'utf-8');

  return FAILED_LINKS_LOG_FILE;
}

function buildFailedLinkTableRows(failures: LinkResult[], rowClass: string): string {
  if (failures.length === 0) {
    return `<tr><td colspan="7" class="empty">None</td></tr>`;
  }

  return failures
    .map((r, index) => {
      const alsoOn =
        r.sourcePages.length > 1
          ? r.sourcePages
              .slice(1)
              .map((p) => `<li><a href="${escapeHtml(p)}">${escapeHtml(p)}</a></li>`)
              .join('')
          : '';

      const alsoOnCell = alsoOn
        ? `<ul class="also-on">${alsoOn}</ul>`
        : '—';

      return `
        <tr class="${rowClass}">
          <td>${index + 1}</td>
          <td>${r.status}</td>
          <td>${r.linkType}</td>
          <td><a href="${escapeHtml(r.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(r.url)}</a></td>
          <td>${escapeHtml(r.linkText || '—')}</td>
          <td>${escapeHtml(r.sourcePageTitle || r.sourcePage)}</td>
          <td><a href="${escapeHtml(r.sourcePage)}" target="_blank" rel="noopener noreferrer">${escapeHtml(r.sourcePage)}</a>${alsoOnCell !== '—' ? `<div class="also-on-label">Also on:</div>${alsoOnCell}` : ''}</td>
        </tr>`;
    })
    .join('');
}

function buildFailedLinksHtmlContent(
  internalFailed: LinkResult[],
  externalFailed: LinkResult[],
  generatedAt: string
): string {
  const internalRows = buildFailedLinkTableRows(internalFailed, 'fail');
  const externalRows = buildFailedLinkTableRows(externalFailed, 'external-fail');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Failed Links Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f4f6f9; color: #1a1a2e; padding: 2rem; }
    h1 { font-size: 1.6rem; margin-bottom: 0.25rem; }
    .subtitle { color: #6b7280; margin-bottom: 1.5rem; font-size: 0.9rem; }
    .cards { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.5rem; }
    .card { background: #fff; border-radius: 8px; padding: 1rem 1.5rem; box-shadow: 0 1px 4px rgba(0,0,0,.08); min-width: 140px; }
    .card .label { font-size: 0.75rem; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; }
    .card .value { font-size: 1.8rem; font-weight: 700; margin-top: 0.25rem; }
    .card.fail .value { color: #dc2626; }
    .card.warn .value { color: #d97706; }
    section { background: #fff; border-radius: 8px; padding: 1.5rem; box-shadow: 0 1px 4px rgba(0,0,0,.08); margin-bottom: 1.5rem; }
    section h2 { font-size: 1rem; margin-bottom: 0.25rem; color: #374151; }
    section .section-note { font-size: 0.85rem; color: #6b7280; margin-bottom: 0.75rem; }
    table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    th { background: #f9fafb; text-align: left; padding: 0.6rem 0.75rem; border-bottom: 2px solid #e5e7eb; color: #374151; }
    td { padding: 0.55rem 0.75rem; border-bottom: 1px solid #f3f4f6; word-break: break-word; vertical-align: top; }
    tr.fail td { background: #fef2f2; }
    tr.external-fail td { background: #fff7ed; }
    td.empty { text-align: center; color: #6b7280; font-style: italic; }
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .also-on-label { font-size: 0.75rem; color: #6b7280; margin-top: 0.5rem; }
    ul.also-on { padding-left: 1rem; margin-top: 0.25rem; font-size: 0.8rem; }
    ul.also-on li { margin-bottom: 0.2rem; }
  </style>
</head>
<body>
  <h1>Failed Links Report</h1>
  <p class="subtitle">Generated: ${escapeHtml(generatedAt)}</p>

  <div class="cards">
    <div class="card fail"><div class="label">Internal Failed</div><div class="value">${internalFailed.length}</div></div>
    <div class="card warn"><div class="label">External Failed</div><div class="value">${externalFailed.length}</div></div>
  </div>

  <section>
    <h2>Internal Failures (action required)</h2>
    <p class="section-note">These broken links are on your site. The test fails when any internal link is broken.</p>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Status</th>
          <th>Type</th>
          <th>URL</th>
          <th>Link Text</th>
          <th>Source Page</th>
          <th>Source URL</th>
        </tr>
      </thead>
      <tbody>${internalRows}</tbody>
    </table>
  </section>

  <section>
    <h2>External Failures (informational)</h2>
    <p class="section-note">Third-party or off-site links that returned errors. Logged for reference; they do not fail the test.</p>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Status</th>
          <th>Type</th>
          <th>URL</th>
          <th>Link Text</th>
          <th>Source Page</th>
          <th>Source URL</th>
        </tr>
      </thead>
      <tbody>${externalRows}</tbody>
    </table>
  </section>
</body>
</html>`;
}

/**
 * Writes failed links to reports/failed-links.html.
 * Mirrors failed-links.log structure with internal and external sections.
 */
export async function generateFailedLinksHtmlReport(results: LinkResult[]): Promise<string> {
  const internalFailed = getInternalFailures(results);
  const externalFailed = getExternalFailures(results);
  const generatedAt = new Date().toISOString();
  const html = buildFailedLinksHtmlContent(internalFailed, externalFailed, generatedAt);

  await fs.promises.mkdir(REPORT_DIR, { recursive: true });
  await fs.promises.writeFile(FAILED_LINKS_HTML_FILE, html, 'utf-8');

  return FAILED_LINKS_HTML_FILE;
}

export async function generateReports(
  results: LinkResult[],
  options: ReportOptions
): Promise<ReportPaths> {
  const jsonPath = await generateJsonReport(results, options);
  const htmlPath = await generateHtmlReport(results, options);
  const failedLinksLogPath = await generateFailedLinksLog(results);
  const failedLinksHtmlPath = await generateFailedLinksHtmlReport(results);

  return { jsonPath, htmlPath, failedLinksLogPath, failedLinksHtmlPath };
}
