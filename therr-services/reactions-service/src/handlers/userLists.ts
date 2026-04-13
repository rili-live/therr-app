import { internalRestRequest } from 'therr-js-utilities/internal-rest-request';
import { parseHeaders } from 'therr-js-utilities/http';
import handleHttpError from '../utilities/handleHttpError';
import Store from '../store';
import * as globalConfig from '../../../../global-config';

const DEFAULT_LIST_NAME = 'Saved';

const ensureDefaultList = async (userId: string) => {
    let defaultList = await Store.userLists.findDefaultForUser(userId);
    if (!defaultList) {
        defaultList = await Store.userLists.create({
            userId,
            name: DEFAULT_LIST_NAME,
            isDefault: true,
        });
    }
    return defaultList;
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

    try {
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
    } catch (err) {
        return handleHttpError({ err, res, message: 'SQL:USER_LISTS_ROUTES:GET_ERROR' });
    }
};

// Get a single list with its spaces
const getUserListById = async (req, res) => {
    const { userId } = parseHeaders(req.headers);
    const { listId } = req.params;

    if (!userId) {
        return handleHttpError({ res, message: 'Unauthorized', statusCode: 401 });
    }

    try {
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
    } catch (err) {
        return handleHttpError({ err, res, message: 'SQL:USER_LISTS_ROUTES:GET_BY_ID_ERROR' });
    }
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
                await Store.spaceReactions.update(
                    { userId },
                    { userBookmarkCategory: updates.name } as any,
                    { columns: ['spaceId'], whereInArray: [spaceIds] as any },
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

    try {
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
    } catch (err) {
        return handleHttpError({ err, res, message: 'SQL:USER_LISTS_ROUTES:DELETE_ERROR' });
    }
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

    try {
        const list = await Store.userLists.getById(listId);
        if (!list || list.userId !== userId) {
            return handleHttpError({ res, message: 'List not found', statusCode: 404 });
        }

        const item = await Store.userListItems.add({
            listId,
            contentId: spaceId,
            contentType: 'space',
        });

        // Upsert the spaceReactions row so legacy read paths still flag this space as bookmarked
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

        if (item) {
            // Only bump count if a new row was actually inserted (onConflict ignore returns undefined)
            await Store.userLists.incrementItemCount(listId, 1);
        }

        const refreshed = await Store.userLists.getById(listId);
        return res.status(200).send({ list: refreshed, added: !!item });
    } catch (err) {
        return handleHttpError({ err, res, message: 'SQL:USER_LISTS_ROUTES:ADD_SPACE_ERROR' });
    }
};

// Remove a space from a list
const removeSpaceFromList = async (req, res) => {
    const { userId } = parseHeaders(req.headers);
    const { listId, spaceId } = req.params;

    if (!userId) {
        return handleHttpError({ res, message: 'Unauthorized', statusCode: 401 });
    }

    try {
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
    } catch (err) {
        return handleHttpError({ err, res, message: 'SQL:USER_LISTS_ROUTES:REMOVE_SPACE_ERROR' });
    }
};

// Get the list IDs that a given space currently belongs to (for the picker checkbox state)
const getListsForSpace = async (req, res) => {
    const { userId } = parseHeaders(req.headers);
    const { spaceId } = req.params;

    if (!userId) {
        return handleHttpError({ res, message: 'Unauthorized', statusCode: 401 });
    }

    try {
        const lists = await Store.userListItems.getListsForContent(userId, spaceId, 'space');
        return res.status(200).send({ lists });
    } catch (err) {
        return handleHttpError({ err, res, message: 'SQL:USER_LISTS_ROUTES:FOR_SPACE_ERROR' });
    }
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
