import { internalRestRequest } from 'therr-js-utilities/internal-rest-request';
import { parseHeaders } from 'therr-js-utilities/http';
import handleHttpError from '../utilities/handleHttpError';
// Handlers without custom error branching are wrapped at the router with
// `asyncHandler` (see ../routes/userListsRouter.ts). Keeping try/catch here
// only where we need to special-case an error (e.g. PG unique violation 23505).
import Store from '../store';
import * as globalConfig from '../../../../global-config';

const DEFAULT_LIST_NAME = 'Saved';
const UNIQUE_VIOLATION = '23505';

// Race-safe: two concurrent first-bookmarks from the same user would each see no
// default list and try to create one. One wins; the other hits the unique index
// (either the (userId, LOWER(name)) index or the partial (userId) WHERE isDefault
// index). On conflict we re-read and return whichever list exists.
const ensureDefaultList = async (userId: string) => {
    const existing = await Store.userLists.findDefaultForUser(userId);
    if (existing) return existing;

    try {
        return await Store.userLists.create({
            userId,
            name: DEFAULT_LIST_NAME,
            isDefault: true,
        });
    } catch (err: any) {
        if (err?.code === UNIQUE_VIOLATION) {
            // Someone else created it (or a list with the same name). Return
            // whichever is actually the user's default; fall back to the "Saved"
            // list if a default exists under a different name.
            const raceDefault = await Store.userLists.findDefaultForUser(userId);
            if (raceDefault) return raceDefault;
            const byName = await Store.userLists.findByUserAndName(userId, DEFAULT_LIST_NAME);
            if (byName) return byName;
        }
        throw err;
    }
};

// Create a new list
const createUserList = async (req, res) => {
    const { userId } = parseHeaders(req.headers);

    if (!userId) {
        return handleHttpError({ res, message: 'Unauthorized', statusCode: 401 });
    }

    const {
        name, description, iconName, colorHex, isPublic, isDefault,
    } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
        return handleHttpError({ res, message: 'List name is required', statusCode: 400 });
    }

    try {
        // If marking this list as default, unset any existing default for this user
        if (isDefault) {
            await Store.userLists.update({ userId }, { isDefault: false });
        }

        const created = await Store.userLists.create({
            userId,
            name: name.trim().slice(0, 120),
            description,
            iconName,
            colorHex,
            isPublic,
            isDefault,
        });

        return res.status(201).send(created);
    } catch (err: any) {
        // Unique violation on (userId, LOWER(name)) returns 23505
        if (err?.code === '23505') {
            return handleHttpError({ res, message: 'A list with that name already exists', statusCode: 409 });
        }
        return handleHttpError({ err, res, message: 'SQL:USER_LISTS_ROUTES:CREATE_ERROR' });
    }
};

// Get all lists for the current user
const getUserLists = async (req, res) => {
    const { userId } = parseHeaders(req.headers);

    if (!userId) {
        return handleHttpError({ res, message: 'Unauthorized', statusCode: 401 });
    }

    const withPreviews = req.query.withPreviews === 'true' || req.query.withPreviews === true;

    const lists = await Store.userLists.get({ userId });

    if (!withPreviews || !lists.length) {
        return res.status(200).send({ lists });
    }

    // Build a preview of the first N items per list (space IDs only for now)
    const listIds = lists.map((l) => l.id);
    const previewRows = await Store.userListItems.getPreviewItems(listIds, 3);
    const previewsByList: Record<string, any[]> = {};
    previewRows.forEach((row) => {
        if (!previewsByList[row.listId]) previewsByList[row.listId] = [];
        previewsByList[row.listId].push(row);
    });

    const enriched = lists.map((list) => ({
        ...list,
        itemPreviews: previewsByList[list.id] || [],
    }));

    return res.status(200).send({ lists: enriched });
};

// Get a single list with its spaces
const getUserListById = async (req, res) => {
    const { userId } = parseHeaders(req.headers);
    const { listId } = req.params;

    if (!userId) {
        return handleHttpError({ res, message: 'Unauthorized', statusCode: 401 });
    }

    const list = await Store.userLists.getById(listId);

    if (!list || list.userId !== userId) {
        return handleHttpError({ res, message: 'List not found', statusCode: 404 });
    }

    const items = await Store.userListItems.getByList(listId, {
        limit: parseInt(req.query.limit, 10) || 100,
        offset: parseInt(req.query.offset, 10) || 0,
    });

    const spaceIds = items
        .filter((item) => item.contentType === 'space')
        .map((item) => item.contentId);

    let spaces: any[] = [];
    let media: any;

    if (spaceIds.length) {
        try {
            const response = await internalRestRequest({
                headers: req.headers,
            }, {
                method: 'post',
                url: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}/spaces/find`,
                data: {
                    spaceIds,
                    limit: spaceIds.length,
                    withMedia: true,
                    withUser: true,
                    isDraft: false,
                },
            });
            spaces = response?.data?.spaces || [];
            media = response?.data?.media;
        } catch (err) {
            // Non-fatal — still return the list with whatever we have
            spaces = [];
        }
    }

    // Attach the reaction for each space (bookmark state, etc.)
    const reactions = spaceIds.length
        ? await Store.spaceReactions.get({ userId }, spaceIds, { limit: spaceIds.length, offset: 0, order: 'DESC' })
        : [];
    const reactionBySpaceId = reactions.reduce((acc: Record<string, any>, cur: any) => {
        acc[cur.spaceId] = cur;
        return acc;
    }, {});
    spaces = spaces.map((s) => ({ ...s, reaction: reactionBySpaceId[s.id] || {} }));

    return res.status(200).send({
        list: {
            ...list,
            items,
            spaces,
        },
        media,
    });
};

// Update a list (rename, recolor, etc.)
const updateUserList = async (req, res) => {
    const { userId } = parseHeaders(req.headers);
    const { listId } = req.params;

    if (!userId) {
        return handleHttpError({ res, message: 'Unauthorized', statusCode: 401 });
    }

    try {
        const existing = await Store.userLists.getById(listId);
        if (!existing || existing.userId !== userId) {
            return handleHttpError({ res, message: 'List not found', statusCode: 404 });
        }

        const {
            name, description, iconName, colorHex, isPublic, isDefault,
        } = req.body;

        if (isDefault === true) {
            // Unset any existing default
            await Store.userLists.update({ userId }, { isDefault: false });
        }

        const updates: any = {};
        if (name !== undefined) updates.name = String(name).trim().slice(0, 120);
        if (description !== undefined) updates.description = description;
        if (iconName !== undefined) updates.iconName = iconName;
        if (colorHex !== undefined) updates.colorHex = colorHex;
        if (isPublic !== undefined) updates.isPublic = !!isPublic;
        if (isDefault !== undefined) updates.isDefault = !!isDefault;

        const [updated] = await Store.userLists.update({ id: listId, userId }, updates);

        // If we renamed the list, keep userBookmarkCategory in sync on member reactions.
        // (Best-effort; not critical for correctness since userBookmarkCategory is a legacy signal.)
        if (updates.name && updates.name !== existing.name) {
            const items = await Store.userListItems.getByList(listId, { limit: 1000, offset: 0 });
            const spaceIds = items.filter((i) => i.contentType === 'space').map((i) => i.contentId);
            if (spaceIds.length) {
                // whereInArray expects one tuple per row for tuple-style WHERE (col) IN ((v1),(v2))
                await Store.spaceReactions.update(
                    { userId },
                    { userBookmarkCategory: updates.name } as any,
                    { columns: ['spaceId'], whereInArray: spaceIds.map((id) => [id]) as any },
                );
            }
        }

        return res.status(200).send(updated);
    } catch (err: any) {
        if (err?.code === '23505') {
            return handleHttpError({ res, message: 'A list with that name already exists', statusCode: 409 });
        }
        return handleHttpError({ err, res, message: 'SQL:USER_LISTS_ROUTES:UPDATE_ERROR' });
    }
};

// Delete a list (cascade removes items; also clears userBookmarkCategory on reactions
// that are no longer referenced by any list)
const deleteUserList = async (req, res) => {
    const { userId } = parseHeaders(req.headers);
    const { listId } = req.params;

    if (!userId) {
        return handleHttpError({ res, message: 'Unauthorized', statusCode: 401 });
    }

    const existing = await Store.userLists.getById(listId);
    if (!existing || existing.userId !== userId) {
        return handleHttpError({ res, message: 'List not found', statusCode: 404 });
    }
    if (existing.isDefault) {
        return handleHttpError({ res, message: 'The default list cannot be deleted', statusCode: 400 });
    }

    // Snapshot items before deleting so we can fix up the reactions table afterwards
    const items = await Store.userListItems.getByList(listId, { limit: 1000, offset: 0 });
    const affectedSpaceIds = items.filter((i) => i.contentType === 'space').map((i) => i.contentId);

    await Store.userLists.delete({ id: listId, userId });

    // For each space that was in the deleted list, check whether it still belongs
    // to any other list for this user. If not, clear userBookmarkCategory.
    for (const spaceId of affectedSpaceIds) {
        // eslint-disable-next-line no-await-in-loop
        const remainingLists = await Store.userListItems.getListsForContent(userId, spaceId, 'space');
        if (!remainingLists.length) {
            // eslint-disable-next-line no-await-in-loop
            await Store.spaceReactions.update(
                { userId, spaceId } as any,
                { userBookmarkCategory: null } as any,
            );
        } else {
            // Keep userBookmarkCategory pointing at a remaining list's name
            // eslint-disable-next-line no-await-in-loop
            await Store.spaceReactions.update(
                { userId, spaceId } as any,
                { userBookmarkCategory: remainingLists[0].name } as any,
            );
        }
    }

    return res.status(200).send({ deleted: true, id: listId });
};

// Add a space to a list
const addSpaceToList = async (req, res) => {
    const { userId } = parseHeaders(req.headers);
    const { listId } = req.params;
    const { spaceId } = req.body;

    if (!userId) {
        return handleHttpError({ res, message: 'Unauthorized', statusCode: 401 });
    }
    if (!spaceId) {
        return handleHttpError({ res, message: 'spaceId is required', statusCode: 400 });
    }

    const list = await Store.userLists.getById(listId);
    if (!list || list.userId !== userId) {
        return handleHttpError({ res, message: 'List not found', statusCode: 404 });
    }

    // Upsert the spaceReactions row FIRST so legacy read paths are consistent
    // even if a subsequent step fails. If this throws, no list state changed.
    const existing = await Store.spaceReactions.get({ userId, spaceId });
    if (existing?.length) {
        await Store.spaceReactions.update(
            { userId, spaceId } as any,
            { userBookmarkCategory: list.name } as any,
        );
    } else {
        await Store.spaceReactions.create({
            userId,
            spaceId,
            userBookmarkCategory: list.name,
        } as any);
    }

    // Then insert the junction row and bump itemCount together. If the
    // junction insert fails, the reaction still reflects a bookmarked state
    // (user sees the icon filled); a retry will land it in the list.
    const item = await Store.userListItems.add({
        listId,
        contentId: spaceId,
        contentType: 'space',
    });

    if (item) {
        // Only bump count if a new row was actually inserted (onConflict ignore returns undefined)
        await Store.userLists.incrementItemCount(listId, 1);
    }

    const refreshed = await Store.userLists.getById(listId);
    return res.status(200).send({ list: refreshed, added: !!item });
};

// Remove a space from a list
const removeSpaceFromList = async (req, res) => {
    const { userId } = parseHeaders(req.headers);
    const { listId, spaceId } = req.params;

    if (!userId) {
        return handleHttpError({ res, message: 'Unauthorized', statusCode: 401 });
    }

    const list = await Store.userLists.getById(listId);
    if (!list || list.userId !== userId) {
        return handleHttpError({ res, message: 'List not found', statusCode: 404 });
    }

    const removed = await Store.userListItems.remove({
        listId,
        contentId: spaceId,
        contentType: 'space',
    });

    if (removed?.length) {
        await Store.userLists.incrementItemCount(listId, -1);
    }

    // Determine remaining list memberships for this space
    const remainingLists = await Store.userListItems.getListsForContent(userId, spaceId, 'space');
    if (!remainingLists.length) {
        await Store.spaceReactions.update(
            { userId, spaceId } as any,
            { userBookmarkCategory: null } as any,
        );
    } else {
        await Store.spaceReactions.update(
            { userId, spaceId } as any,
            { userBookmarkCategory: remainingLists[0].name } as any,
        );
    }

    const refreshed = await Store.userLists.getById(listId);
    return res.status(200).send({ list: refreshed, removed: !!removed?.length });
};

// Get the list IDs that a given space currently belongs to (for the picker checkbox state)
const getListsForSpace = async (req, res) => {
    const { userId } = parseHeaders(req.headers);
    const { spaceId } = req.params;

    if (!userId) {
        return handleHttpError({ res, message: 'Unauthorized', statusCode: 401 });
    }

    const lists = await Store.userListItems.getListsForContent(userId, spaceId, 'space');
    return res.status(200).send({ lists });
};

export {
    DEFAULT_LIST_NAME,
    ensureDefaultList,
    createUserList,
    getUserLists,
    getUserListById,
    updateUserList,
    deleteUserList,
    addSpaceToList,
    removeSpaceFromList,
    getListsForSpace,
};
