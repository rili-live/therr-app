/**
 * Safely extracts a display title from a group object's title field.
 * Handles cases where the title may be a string or an object (e.g., from inconsistent API responses).
 */
export const getDisplayTitle = (title: any): string =>
    typeof title === 'object' ? (title?.title || title?.name || '') : (title || '');
