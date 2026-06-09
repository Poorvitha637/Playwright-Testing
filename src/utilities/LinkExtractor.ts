/**
 * LinkExtractor.ts
 *
 * Shared URL filtering, normalization, and classification utilities.
 * Used by both HTTP (Cheerio) and Playwright extraction paths.
 */

/** href prefixes that should not be validated as HTTP links. */
const IGNORED_PREFIXES = ['mailto:', 'tel:', 'javascript:'];

/**
 * Returns true when the href should be excluded from extraction.
 */
export function shouldIgnoreLink(href: string): boolean {
  const trimmed = href.trim();
  if (!trimmed) return true;

  if (trimmed === '#' || trimmed.startsWith('#')) return true;

  const lower = trimmed.toLowerCase();
  if (lower === 'javascript:void(0)' || lower.startsWith('javascript:void(0)')) {
    return true;
  }

  return IGNORED_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

/**
 * Resolves a possibly relative href against the current page URL.
 * Strips hash fragments from the resolved URL.
 */
export function resolveUrl(href: string, pageUrl: string): string | null {
  try {
    const resolved = new URL(href, pageUrl);
    resolved.hash = '';
    return resolved.href;
  } catch {
    return null;
  }
}

/**
 * Normalizes a URL for visited-set comparisons (strips hash, trailing slash).
 */
export function normalizeUrl(url: string): string {
  const parsed = new URL(url);
  parsed.hash = '';

  if (parsed.pathname.endsWith('/') && parsed.pathname.length > 1) {
    parsed.pathname = parsed.pathname.slice(0, -1);
  }

  return parsed.href;
}

/**
 * Returns true when the URL belongs to the same domain as the base URL.
 */
export function isInternalLink(url: string, baseDomain: string): boolean {
  try {
    return new URL(url).hostname === baseDomain;
  } catch {
    return false;
  }
}

/** File extensions that should be validated but not crawled for discovery. */
const NON_CRAWLABLE_EXTENSIONS = new Set([
  '.pdf', '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.ico', '.bmp',
  '.zip', '.rar', '.tar', '.gz', '.7z',
  '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.mp3', '.mp4', '.avi', '.mov', '.wmv', '.wav',
  '.css', '.js', '.json', '.xml', '.rss', '.atom', '.woff', '.woff2', '.ttf', '.eot',
]);

/**
 * Returns true when the URL points to an HTML page that can be crawled.
 */
export function isCrawlablePage(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    const lastDot = pathname.lastIndexOf('.');
    if (lastDot === -1) return true;

    const extension = pathname.slice(lastDot);
    return !NON_CRAWLABLE_EXTENSIONS.has(extension);
  } catch {
    return false;
  }
}
