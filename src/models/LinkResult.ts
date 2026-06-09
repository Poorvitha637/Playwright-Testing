/**
 * LinkResult.ts
 *
 * Data model representing the outcome of a single link validation check.
 */

/** Validation outcome for a link — PASS when status is acceptable, FAIL otherwise. */
export type LinkValidationResult = 'PASS' | 'FAIL';

/** Whether the validated URL belongs to the target site or an external domain. */
export type LinkType = 'internal' | 'external';

/** How pages were discovered during the crawl. */
export type DiscoveryMethod = 'sitemap' | 'http-crawl' | 'playwright-fallback';

/** Result record for one validated link (unique URL — validated once). */
export interface LinkResult {
  /** Absolute URL that was validated. */
  url: string;

  /** HTTP status code returned by the server, or 0 on network/timeout errors. */
  status: number;

  /** PASS or FAIL based on configured status code rules. */
  result: LinkValidationResult;

  /** Internal (same domain) or external (other domain). */
  linkType: LinkType;

  /** Primary source page URL (first page where this link was found). */
  sourcePage: string;

  /** All source page URLs where this link was discovered. */
  sourcePages: string[];

  /** Primary source page title from the HTML <title> tag. */
  sourcePageTitle: string;

  /** All unique source page titles. */
  sourcePageTitles: string[];

  /** Primary anchor text of the link (first occurrence). */
  linkText: string;

  /** All unique anchor texts found for this URL. */
  linkTexts: string[];
}

/** A link extracted from a page before HTTP validation. */
export interface ExtractedLink {
  /** Resolved absolute URL. */
  url: string;

  /** Page URL where the link was found. */
  sourcePage: string;

  /** Page title from the HTML <title> tag of the source page. */
  sourcePageTitle: string;

  /** Visible anchor text of the link. */
  linkText: string;
}

/** Outcome of the site discovery phase. */
export interface DiscoveryResult {
  pagesDiscovered: string[];
  discoveredLinks: ExtractedLink[];
  discoveryMethod: DiscoveryMethod;
  timedOut: boolean;
  discoveryDurationMs: number;
}
