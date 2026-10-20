// Fixed copies of releases: each release also stays at ".../v/<version>/", unchanged,
// for validated use (see .github/workflows/release.yml).

/**
 * When the app runs from a fixed copy, its version and the live site's address.
 * @param baseUrl import.meta.env.BASE_URL, e.g. "/Barcode-Tool/v/1.0.0/"
 */
export function fixedCopyOf(baseUrl: string): { version: string; liveSite: string } | null {
  const match = /^(.*\/)v\/([^/]+)\/$/.exec(baseUrl);
  if (!match?.[1] || !match[2]) return null;
  return { version: match[2], liveSite: match[1] };
}

/** The address of the fixed copy of a version, below the live site's address. */
export function fixedCopyAddress(liveSiteUrl: string, version: string): string {
  return `${liveSiteUrl.replace(/\/?$/, '/')}v/${version}/`;
}

/** Versions before 1.0.0 are previews: they may still change, with no promise of stability. */
export function isPreview(version: string): boolean {
  return version.startsWith('0.');
}
