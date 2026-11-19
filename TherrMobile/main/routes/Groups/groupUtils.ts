/**
 * Safely extracts a display title from a group object's title field.
 * Handles cases where the title may be a string or an object (e.g., from inconsistent API responses).
 */
export const getDisplayTitle = (title: any): string =>
    typeof title === 'object' ? (title?.title || title?.name || '') : (title || '');

/**
 * Localized label for a forum category.
 *
 * Category names are stored untranslated (`food`, `tech`, ...). A known tag reads its label from
 * `pages.groups.categories.names.<tag>`; any other category (one added in the database without a
 * dictionary entry) falls back to its stored name, capitalized, so it never renders as a raw key.
 */
export const getCategoryLabel = (translate: (key: string, params?: any) => string, category: any): string => {
    const name = String(category?.name || category?.tag || '');
    const key = `pages.groups.categories.names.${category?.tag}`;
    const translated = category?.tag ? translate(key) : '';

    if (translated && translated !== key) {
        return translated;
    }

    return name.charAt(0).toUpperCase() + name.slice(1);
};

/**
 * Picks the fill for a group's fallback avatar (no featured image) from `palette`.
 *
 * Deterministic in the group id, so a group keeps its color across renders, launches and
 * devices, while neighboring groups in a list usually differ.
 */
export const getFallbackAvatarColor = (groupId: any, palette: string[]): string => {
    if (!palette.length) {
        return '';
    }

    const id = String(groupId ?? '');
    let hash = 0;
    for (let i = 0; i < id.length; i += 1) {
        hash = ((hash * 31) + id.charCodeAt(i)) % 2147483647;
    }

    return palette[hash % palette.length];
};

/**
 * The first visible character of a group's title, for its fallback avatar.
 * Uses the first code point rather than the first UTF-16 unit, so a title starting with an emoji
 * renders that emoji instead of half of a surrogate pair.
 */
export const getTitleInitial = (title: any): string => {
    const first = Array.from(getDisplayTitle(title).trim())[0];

    return first ? first.toUpperCase() : '?';
};
