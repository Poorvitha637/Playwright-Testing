/**
 * LinkValidator.ts
 *
 * Validates links via HTTP requests.
 * Supports parallel batch validation with unique URL deduplication.
 */

import axios, { AxiosError } from 'axios';
import pLimit from 'p-limit';
import {
  HTTP_REQUEST_TIMEOUT_MS,
  VALIDATION_CONCURRENCY,
} from '../config/environment';
import {
  ExtractedLink,
  LinkResult,
  LinkType,
  LinkValidationResult,
} from '../models/LinkResult';
import { isInternalLink } from './LinkExtractor';
import { ProgressLogger } from './ProgressLogger';

/** HTTP status codes considered a successful link. */
const PASS_STATUS_CODES = new Set([200, 201, 202, 301, 302]);

const VALIDATION_LOG_INTERVAL = 50;

interface LinkAggregate {
  sourcePages: string[];
  sourcePageTitles: string[];
  linkTexts: string[];
}

/**
 * Maps an HTTP status code to PASS or FAIL.
 */
function evaluateStatus(status: number): LinkValidationResult {
  if (PASS_STATUS_CODES.has(status)) return 'PASS';
  return 'FAIL';
}

/**
 * Sends an HTTP request to a single URL and returns status + result.
 */
async function checkUrl(url: string): Promise<{ status: number; result: LinkValidationResult }> {
  try {
    const headResponse = await axios.head(url, {
      timeout: HTTP_REQUEST_TIMEOUT_MS,
      maxRedirects: 5,
      validateStatus: () => true,
    });

    if (headResponse.status !== 405 && headResponse.status !== 501) {
      return { status: headResponse.status, result: evaluateStatus(headResponse.status) };
    }

    const getResponse = await axios.get(url, {
      timeout: HTTP_REQUEST_TIMEOUT_MS,
      maxRedirects: 5,
      validateStatus: () => true,
    });

    return { status: getResponse.status, result: evaluateStatus(getResponse.status) };
  } catch (error) {
    const status =
      error instanceof AxiosError && error.response?.status ? error.response.status : 0;
    return { status, result: 'FAIL' };
  }
}

function addUnique(target: string[], value: string): void {
  if (value && !target.includes(value)) {
    target.push(value);
  }
}

/**
 * Groups extracted links by unique URL and collects source metadata.
 */
function deduplicateLinks(links: ExtractedLink[]): Map<string, LinkAggregate> {
  const map = new Map<string, LinkAggregate>();

  for (const link of links) {
    let aggregate = map.get(link.url);
    if (!aggregate) {
      aggregate = { sourcePages: [], sourcePageTitles: [], linkTexts: [] };
      map.set(link.url, aggregate);
    }

    addUnique(aggregate.sourcePages, link.sourcePage);
    addUnique(aggregate.sourcePageTitles, link.sourcePageTitle);
    addUnique(aggregate.linkTexts, link.linkText);
  }

  return map;
}

function resolveLinkType(url: string, baseDomain: string): LinkType {
  return isInternalLink(url, baseDomain) ? 'internal' : 'external';
}

/**
 * Validates all unique URLs in parallel batches.
 */
export async function validateLinksBatch(
  links: ExtractedLink[],
  baseUrl: string,
  progress?: ProgressLogger
): Promise<LinkResult[]> {
  const baseDomain = new URL(baseUrl).hostname;
  const uniqueLinks = deduplicateLinks(links);
  const entries = Array.from(uniqueLinks.entries());
  const limit = pLimit(VALIDATION_CONCURRENCY);
  const results: LinkResult[] = [];
  let validated = 0;
  let internalFailed = 0;
  let externalFailed = 0;
  const startTime = Date.now();

  await Promise.all(
    entries.map(([url, aggregate]) =>
      limit(async () => {
        const { status, result } = await checkUrl(url);
        const linkType = resolveLinkType(url, baseDomain);

        const linkResult: LinkResult = {
          url,
          status,
          result,
          linkType,
          sourcePage: aggregate.sourcePages[0],
          sourcePages: aggregate.sourcePages,
          sourcePageTitle: aggregate.sourcePageTitles[0] ?? '',
          sourcePageTitles: aggregate.sourcePageTitles,
          linkText: aggregate.linkTexts[0] ?? '',
          linkTexts: aggregate.linkTexts,
        };

        results.push(linkResult);
        validated += 1;

        if (result === 'FAIL') {
          if (linkType === 'internal') {
            internalFailed += 1;
            progress?.logFailedLink(linkResult);
          } else {
            externalFailed += 1;
          }
        }

        if (validated % VALIDATION_LOG_INTERVAL === 0 || validated === entries.length) {
          progress?.logValidationProgress(validated, entries.length, internalFailed, externalFailed);
        }
      })
    )
  );

  progress?.logValidationComplete(
    entries.length,
    internalFailed,
    externalFailed,
    (Date.now() - startTime) / 1000
  );

  return results.sort((a, b) => a.url.localeCompare(b.url));
}

/** Returns only internal links that failed validation. */
export function getInternalFailures(results: LinkResult[]): LinkResult[] {
  return results.filter((r) => r.linkType === 'internal' && r.result === 'FAIL');
}

/** Returns external links that failed validation (informational). */
export function getExternalFailures(results: LinkResult[]): LinkResult[] {
  return results.filter((r) => r.linkType === 'external' && r.result === 'FAIL');
}
