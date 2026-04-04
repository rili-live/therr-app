/**
 * Converts a string to a URL-friendly slug.
 */
const slugify = (text: string): string => text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 100);

/**
 * Builds a keyword-rich slug for a space detail page.
 * Example: "Joe's Pizza", "Chicago", "IL" → "joes-pizza-chicago-il"
 */
const buildSpaceSlug = (
    name: string,
    locality?: string,
    region?: string,
): string => {
    const parts = [name, locality, region].filter(Boolean);
    return slugify(parts.join(' '));
};

export { slugify, buildSpaceSlug };
