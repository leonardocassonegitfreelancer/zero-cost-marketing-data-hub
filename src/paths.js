// The join key between sources is the page. Each source writes it
// differently:
//   GA4 landing page    "/es/pricing/?utm_source=x"
//   Search Console page "https://www.example.com/es/Pricing"
//   a lead's source URL "https://example.com/es/pricing#form"
// Without one canonical form the three never match and every join silently
// returns nothing. This reduces any of them to a path: no host, no query, no
// fragment, lower case, no trailing slash. The language prefix is kept,
// because /es/pricing and /en/pricing are different pages with different
// audiences.
//
// Lower-casing is a pragmatic choice (paths are case-sensitive in theory,
// almost never in practice for marketing sites). Empty or GA4's "(not set)"
// become '' so they group together instead of becoming fake pages.
const PLACEHOLDER_ORIGIN = 'https://placeholder.invalid';

export function normalizePagePath(value) {
  const text = String(value ?? '').trim();
  if (text === '' || text === '(not set)') return '';

  let pathname;
  try {
    pathname = new URL(text, PLACEHOLDER_ORIGIN).pathname;
  } catch {
    return '';
  }

  const lowered = pathname.toLowerCase();
  if (lowered.length <= 1) return lowered;
  return lowered.replace(/\/+$/, '') || '/';
}
