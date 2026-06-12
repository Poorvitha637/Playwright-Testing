/**
 * ImageReportGenerator.ts
 *
 * Generates JSON and HTML reports for image validation.
 */

import * as fs from 'fs';
import * as path from 'path';
import { ImageResult, STATUS_NOT_CHECKED } from '../models/ImageResult';

const REPORT_DIR = path.resolve(process.cwd(), 'reports');
const JSON_REPORT_FILE = path.join(REPORT_DIR, 'ImageValidationReport.json');
const HTML_REPORT_FILE = path.join(REPORT_DIR, 'ImageValidationReport.html');

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * FIX: Display the status column as a human-readable string.
 * STATUS_NOT_CHECKED (-1) means no HTTP request was made.
 * 0 means a network error occurred during the request.
 * Any other value is the actual HTTP status code.
 */
function formatStatus(status: number): string {
  if (status === STATUS_NOT_CHECKED) return 'Not checked';
  if (status === 0) return 'Network error';
  return String(status);
}

/**
 * FIX: The JSON report now wraps results in a metadata envelope.
 * The original was a bare array — without a wrapper, the file gives
 * no context about when it was generated or which site it covers.
 * This envelope makes the report self-describing and safe to archive.
 */
export async function generateImageJsonReport(
  results: ImageResult[]
): Promise<string> {
  await fs.promises.mkdir(REPORT_DIR, { recursive: true });

  const passed = results.filter((r) => r.result === 'PASS').length;
  const failed = results.filter((r) => r.result === 'FAIL').length;

  const envelope = {
    generatedAt: new Date().toISOString(),
    totalImages: results.length,
    passed,
    failed,
    results,
  };

  await fs.promises.writeFile(
    JSON_REPORT_FILE,
    JSON.stringify(envelope, null, 2),
    'utf-8'
  );

  return JSON_REPORT_FILE;
}

/**
 * FIX: Several improvements to the HTML report:
 *
 * 1. Added sourcePageTitle and hasAltAttribute columns — these were in the
 *    ImageResult model but missing from the HTML output, forcing QA to
 *    cross-reference the raw JSON to see page titles.
 *
 * 2. Added a summary banner at the top — pass/fail totals and a breakdown
 *    by issue type so QA can answer "how bad is it?" at a glance.
 *
 * 3. Added CSS styling — FAIL rows are highlighted red, PASS rows green,
 *    image URLs are clickable links for direct browser verification.
 *
 * 4. Added a generated timestamp and total count to the report header.
 */
export async function generateImageHtmlReport(
  results: ImageResult[]
): Promise<string> {
  await fs.promises.mkdir(REPORT_DIR, { recursive: true });

  const passed = results.filter((r) => r.result === 'PASS').length;
  const failed = results.filter((r) => r.result === 'FAIL').length;

  // Issue type breakdown for the summary.
  const issueCounts = results.reduce<Record<string, number>>((acc, r) => {
    if (r.issue) {
      acc[r.issue] = (acc[r.issue] ?? 0) + 1;
    }
    return acc;
  }, {});

  const issueBreakdownRows = Object.entries(issueCounts)
    .map(
      ([issue, count]) =>
        `<tr><td>${escapeHtml(issue)}</td><td>${count}</td></tr>`
    )
    .join('');

  const tableRows = results
    .map((r) => {
      const rowClass = r.result === 'FAIL' ? 'row-fail' : 'row-pass';
      // FIX: Image URL is now a clickable link so QA can verify in browser directly.
      const imageUrlCell = r.imageUrl
        ? `<a href="${escapeHtml(r.imageUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(r.imageUrl)}</a>`
        : '<em>—</em>';

      return `
      <tr class="${rowClass}">
        <td class="cell-url">${imageUrlCell}</td>
        <td class="cell-status">${formatStatus(r.status)}</td>
        <td class="cell-result ${r.result === 'PASS' ? 'result-pass' : 'result-fail'}">${r.result}</td>
        <td>${escapeHtml(r.altText) || '<em>—</em>'}</td>
        <td>${r.hasAltAttribute ? 'Yes' : 'No'}</td>
        <td>${escapeHtml(r.issue) || '<em>—</em>'}</td>
        <td class="cell-url"><a href="${escapeHtml(r.sourcePage)}" target="_blank" rel="noopener noreferrer">${escapeHtml(r.sourcePage)}</a></td>
        <td>${escapeHtml(r.sourcePageTitle) || '<em>—</em>'}</td>
      </tr>`;
    })
    .join('');

  const generatedAt = new Date().toLocaleString();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Image Validation Report</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      color: #1a1a1a;
      background: #f5f5f5;
      margin: 0;
      padding: 24px;
    }
    h1 { font-size: 20px; margin: 0 0 4px; }
    .meta { font-size: 12px; color: #666; margin-bottom: 24px; }

    /* Summary banner */
    .summary {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 24px;
    }
    .stat-card {
      background: #fff;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 12px 20px;
      min-width: 120px;
    }
    .stat-card .label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: .04em; }
    .stat-card .value { font-size: 24px; font-weight: 600; margin-top: 2px; }
    .stat-card.total  .value { color: #333; }
    .stat-card.pass   .value { color: #1a7f37; }
    .stat-card.fail   .value { color: #cf222e; }

    /* Issue breakdown table */
    .breakdown { margin-bottom: 24px; }
    .breakdown h2 { font-size: 15px; margin: 0 0 8px; }
    .breakdown table { border-collapse: collapse; background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; }
    .breakdown th, .breakdown td { padding: 7px 16px; text-align: left; border-bottom: 1px solid #f0f0f0; }
    .breakdown th { background: #fafafa; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: #666; }
    .breakdown tr:last-child td { border-bottom: none; }

    /* Main results table */
    .results-wrap { overflow-x: auto; }
    table.results {
      width: 100%;
      border-collapse: collapse;
      background: #fff;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      overflow: hidden;
    }
    table.results thead th {
      background: #fafafa;
      padding: 10px 12px;
      text-align: left;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: .04em;
      color: #666;
      border-bottom: 1px solid #e0e0e0;
      white-space: nowrap;
    }
    table.results td {
      padding: 8px 12px;
      border-bottom: 1px solid #f5f5f5;
      vertical-align: top;
    }
    table.results tr:last-child td { border-bottom: none; }
    .row-fail { background: #fff5f5; }
    .row-pass { background: #f6fff8; }
    .result-pass { color: #1a7f37; font-weight: 600; }
    .result-fail { color: #cf222e; font-weight: 600; }
    .cell-url { word-break: break-all; max-width: 280px; font-size: 12px; }
    .cell-url a { color: #0969da; text-decoration: none; }
    .cell-url a:hover { text-decoration: underline; }
    .cell-status { white-space: nowrap; }
  </style>
</head>
<body>
  <h1>Image Validation Report</h1>
  <p class="meta">Generated: ${escapeHtml(generatedAt)} &nbsp;|&nbsp; Total images: ${results.length}</p>

  <div class="summary">
    <div class="stat-card total"><div class="label">Total</div><div class="value">${results.length}</div></div>
    <div class="stat-card pass"><div class="label">Passed</div><div class="value">${passed}</div></div>
    <div class="stat-card fail"><div class="label">Failed</div><div class="value">${failed}</div></div>
  </div>

  ${
    issueBreakdownRows
      ? `<div class="breakdown">
    <h2>Failures by issue type</h2>
    <table>
      <thead><tr><th>Issue</th><th>Count</th></tr></thead>
      <tbody>${issueBreakdownRows}</tbody>
    </table>
  </div>`
      : ''
  }

  <div class="results-wrap">
    <table class="results">
      <thead>
        <tr>
          <th>Image URL</th>
          <th>HTTP Status</th>
          <th>Result</th>
          <th>ALT Text</th>
          <th>Has ALT Attr</th>
          <th>Issue</th>
          <th>Source Page</th>
          <th>Page Title</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>
  </div>
</body>
</html>`;

  await fs.promises.writeFile(HTML_REPORT_FILE, html, 'utf-8');

  return HTML_REPORT_FILE;
}

export async function generateImageReports(
  results: ImageResult[]
): Promise<{ jsonPath: string; htmlPath: string }> {
  const jsonPath = await generateImageJsonReport(results);
  const htmlPath = await generateImageHtmlReport(results);
  return { jsonPath, htmlPath };
}