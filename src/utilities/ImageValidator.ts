/**
 * ImageValidator.ts
 *
 * Validates images via HTTP requests and metadata checks.
 */

import axios, { AxiosError } from 'axios';
import pLimit from 'p-limit';

import {
  HTTP_REQUEST_TIMEOUT_MS,
  VALIDATION_CONCURRENCY,
} from '../config/environment';

import {
  ExtractedImage,
  ImageIssueType,
  ImageResult,
  ImageValidationResult,
  STATUS_NOT_CHECKED,
} from '../models/ImageResult';

/**
 * FIX: Only 200 should be treated as PASS for image availability.
 *
 * Removed 201, 202: these mean "Created" and "Accepted" — server-side
 * processing responses that are never returned when serving a static
 * image file. Including them was semantically wrong.
 *
 * Removed 301, 302: Axios is configured with maxRedirects: 5, so it
 * follows redirects automatically before returning. The status code
 * you receive is always the *final* response after all redirects have
 * been followed. 301/302 are therefore never the actual status value
 * in a successful response — they were dead entries that made the code
 * look like it handled redirects when it did not need to.
 */
const PASS_STATUS_CODES = new Set([200]);

function evaluateStatus(status: number): ImageValidationResult {
  return PASS_STATUS_CODES.has(status) ? 'PASS' : 'FAIL';
}

/**
 * FIX: Added HEAD → GET fallback for 405 Method Not Allowed.
 *
 * Some servers (CDNs, S3-compatible hosts, some web frameworks) return
 * 405 for HEAD requests even though the resource exists and is served
 * normally on GET. Without this fallback, valid images on those servers
 * are permanently reported as broken. The GET request uses a Range header
 * to fetch only the first byte, keeping bandwidth usage negligible.
 */
async function checkImageUrl(
  imageUrl: string
): Promise<{ status: number; result: ImageValidationResult }> {
  try {
    const headResponse = await axios.head(imageUrl, {
      timeout: HTTP_REQUEST_TIMEOUT_MS,
      maxRedirects: 5,
      validateStatus: () => true,
    });

    if (headResponse.status === 405) {
      // Server does not support HEAD — fall back to a minimal GET request.
      const getResponse = await axios.get(imageUrl, {
        timeout: HTTP_REQUEST_TIMEOUT_MS,
        maxRedirects: 5,
        validateStatus: () => true,
        headers: { Range: 'bytes=0-0' },
        responseType: 'stream',
      });

      // Destroy the stream immediately — we only need the status code.
      getResponse.data?.destroy?.();

      return {
        status: getResponse.status === 206 ? 200 : getResponse.status,
        result: evaluateStatus(getResponse.status === 206 ? 200 : getResponse.status),
      };
    }

    return {
      status: headResponse.status,
      result: evaluateStatus(headResponse.status),
    };
  } catch (error) {
    // status 0 = network-level failure during an actual request attempt
    // (connection refused, DNS failure, timeout, etc.).
    const status =
      error instanceof AxiosError && error.response?.status
        ? error.response.status
        : 0;

    return {
      status,
      result: 'FAIL',
    };
  }
}

/**
 * FIX: Extracted a shared helper to build FAIL result objects.
 *
 * The original code repeated the full result literal three times with
 * minor variations. Any future change to ImageResult's shape required
 * editing three separate places in sync. This helper centralises the
 * construction and uses STATUS_NOT_CHECKED (-1) for records where no
 * HTTP request was made, making them distinguishable in reports from
 * records where a network error occurred (status 0).
 */
function buildSkippedResult(
  image: ExtractedImage,
  issue: ImageIssueType,
  overrides: Partial<Pick<ImageResult, 'altText' | 'hasAltAttribute' | 'imageUrl'>> = {}
): ImageResult {
  return {
    imageUrl: overrides.imageUrl ?? image.imageUrl,
    status: STATUS_NOT_CHECKED,
    result: 'FAIL',
    sourcePage: image.sourcePage,
    sourcePageTitle: image.sourcePageTitle,
    altText: overrides.altText ?? image.altText,
    hasAltAttribute: overrides.hasAltAttribute ?? image.hasAltAttribute,
    issue,
  };
}

/**
 * Validates all discovered images.
 */
export async function validateImagesBatch(
  images: ExtractedImage[]
): Promise<ImageResult[]> {
  const limit = pLimit(VALIDATION_CONCURRENCY);

  return Promise.all(
    images.map((image) =>
      limit(async () => {

        // Missing src — no URL to validate.
        if (!image.imageUrl) {
          return buildSkippedResult(image, 'Missing Image Source', {
            imageUrl: '',
          });
        }

        // Missing alt attribute entirely.
        // FIX: was returning status: 0 (network error sentinel).
        // Now returns STATUS_NOT_CHECKED (-1) because no HTTP request
        // was made — this is a metadata failure, not a network failure.
        if (!image.hasAltAttribute) {
          return buildSkippedResult(image, 'Missing ALT Text', {
            altText: '',
            hasAltAttribute: false,
          });
        }

        // alt attribute present but empty (alt="").
        // FIX: same status correction as above. Also note: per WCAG 2.1
        // SC 1.1.1, alt="" is intentionally valid for decorative images.
        // If your site uses decorative images correctly, consider changing
        // this to a WARNING category rather than a hard FAIL.
        if (image.altText.trim() === '') {
          return buildSkippedResult(image, 'Empty ALT Text', {
            altText: '',
            hasAltAttribute: true,
          });
        }

        // All metadata checks passed — now make the HTTP request.
        const { status, result } = await checkImageUrl(image.imageUrl);

        return {
          imageUrl: image.imageUrl,
          status,
          result,
          sourcePage: image.sourcePage,
          sourcePageTitle: image.sourcePageTitle,
          altText: image.altText,
          hasAltAttribute: image.hasAltAttribute,
          issue: result === 'FAIL' ? ('Broken Image' as ImageIssueType) : '',
        };
      })
    )
  );
}