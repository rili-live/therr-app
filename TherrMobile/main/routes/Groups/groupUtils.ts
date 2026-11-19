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

/** Unread badge text: the count, capped so a busy group does not widen the row. */
export const formatUnreadCount = (count: number): string => (count > 99 ? '99+' : String(Math.max(0, count)));

/**
 * The "Your Groups" preview line for a group's latest message: "You: …", "alex: …", or a
 * placeholder when the group has no messages yet. Whitespace (including line breaks) is collapsed
 * so a multi-line message previews as one run of text.
 */
export const getLastMessagePreview = (
    translate: (key: string, params?: any) => string,
    lastMessage: any,
    viewerUserId?: string,
): string => {
    const text = String(lastMessage?.text || '').replace(/\s+/g, ' ').trim();
    if (!lastMessage || !text) {
        return translate('pages.groups.labels.noMessagesYet');
    }

    if (viewerUserId && lastMessage.fromUserId === viewerUserId) {
        return translate('pages.groups.labels.lastMessageYou', { text });
    }

    if (lastMessage.fromUserName) {
        return translate('pages.groups.labels.lastMessageFrom', { name: lastMessage.fromUserName, text });
    }

    return text;
};

/**
 * A chat sender's name color, picked from `palette` by their user id (or name, for a message that
 * carries no id). Same person, same color on every launch and device — unlike the random color the
 * chat used before, which was cached only in memory and reshuffled on every app start.
 */
export const getSenderColor = (senderKey: any, palette: string[]): string => getFallbackAvatarColor(senderKey, palette);

/**
 * Whether a chat message is the viewer's own. Live messages echoed back by the websocket service
 * carry `fromUserName: 'you'` and no sender id; stored ones carry `fromUserId`. Compared exactly:
 * a substring match on "you" also claimed messages from anyone named, say, "Youssef".
 */
export const isOwnForumMessage = (item: any, viewerUserId?: string): boolean => {
    if (viewerUserId && item?.fromUserId) {
        return item.fromUserId === viewerUserId;
    }

    return String(item?.fromUserName || '').toLowerCase() === 'you';
};
