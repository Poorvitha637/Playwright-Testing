/**
 * ImageResult.ts
 *
 * Data model representing the outcome of a single image validation check.
 */

/** Validation outcome for an image. */
export type ImageValidationResult = 'PASS' | 'FAIL';

/**
 * Strict union of all possible validation issue descriptions.
 * Using '' (empty string) to represent no issue keeps the field
 * always present and avoids optional-field null checks downstream.
 */
export type ImageIssueType =
  | 'Missing Image Source'
  | 'Missing ALT Text'
  | 'Empty ALT Text'
  | 'Broken Image'
  | '';

/**
 * Sentinel value used as the HTTP status field when no HTTP request
 * was made (i.e. the image was rejected at the metadata stage before
 * any network call). Distinct from 0, which conventionally means a
 * network-level failure occurred during an actual request attempt.
 */
export const STATUS_NOT_CHECKED = -1;

/** Result record for one validated image. */
export interface ImageResult {
  /** Absolute image URL. */
  imageUrl: string;

  /**
   * HTTP status code returned by the image request.
   * Set to STATUS_NOT_CHECKED (-1) when no HTTP request was attempted
   * (e.g. image failed ALT or src validation before network check).
   * Set to 0 when a network-level error occurred during the request.
   */
  status: number;

  /** PASS or FAIL based on validation rules. */
  result: ImageValidationResult;

  /** Page URL where the image was found. */
  sourcePage: string;

  /** Page title where the image was found. */
  sourcePageTitle: string;

  /** ALT text value. */
  altText: string;

  /** Whether ALT attribute exists on the element. */
  hasAltAttribute: boolean;

  /** Validation issue description. Empty string when result is PASS. */
  issue: ImageIssueType;
}

/** Image extracted from a page before validation. */
export interface ExtractedImage {
  /** Resolved image URL. */
  imageUrl: string;

  /** Page URL where image was found. */
  sourcePage: string;

  /** Page title where image was found. */
  sourcePageTitle: string;

  /** ALT text value. */
  altText: string;

  /** Whether ALT attribute exists on the element. */
  hasAltAttribute: boolean;
}