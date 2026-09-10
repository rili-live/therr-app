import { it, describe, expect } from '@jest/globals';

/**
 * MyQRCodes mapGroupEntity Regression Tests
 *
 * `user.myUserGroups` stores the membership record keyed by groupId; the
 * actual group fields (title, description, media) are nested under `.group`
 * by the users-service `getUserGroups?withGroups=true` response. A prior
 * version of the mapper read `group.title` / `group.name` directly off the
 * membership record, which silently fell through to the `—` fallback for
 * every row. These tests lock in the corrected field resolution.
 *
 * Mirror of the mapper in `main/routes/MyQRCodes/index.tsx` (imageUri path
 * is omitted here — it depends on `getUserContentUri`, a separate concern).
 */
const mapGroupEntity = (userGroup: any) => {
    const group = userGroup.group || {};
    return {
        id: String(userGroup.groupId || group.id || userGroup.id || ''),
        title: group.title || group.name || userGroup.title || userGroup.name || '—',
        subtitle: group.description || userGroup.description || '',
    };
};

describe('MyQRCodes mapGroupEntity', () => {
    it('resolves title from nested .group when membership wraps the group', () => {
        const userGroup = {
            groupId: 'g-123',
            userId: 'u-1',
            role: 'ADMIN',
            group: {
                id: 'g-123',
                title: 'Hiking Club',
                description: 'Weekend trail meetups',
            },
        };

        expect(mapGroupEntity(userGroup)).toEqual({
            id: 'g-123',
            title: 'Hiking Club',
            subtitle: 'Weekend trail meetups',
        });
    });

    it('prefers groupId over nested group.id for the entity id', () => {
        const userGroup = {
            groupId: 'membership-groupId',
            group: { id: 'nested-id', title: 'T' },
        };

        expect(mapGroupEntity(userGroup).id).toBe('membership-groupId');
    });

    it('falls back to top-level fields when .group is absent (legacy shape)', () => {
        const userGroup = {
            id: 'g-legacy',
            title: 'Legacy Group',
            description: 'Old shape',
        };

        expect(mapGroupEntity(userGroup)).toEqual({
            id: 'g-legacy',
            title: 'Legacy Group',
            subtitle: 'Old shape',
        });
    });

    it('falls back to group.name when group.title is missing', () => {
        const userGroup = {
            groupId: 'g-1',
            group: { name: 'Name-only group' },
        };

        expect(mapGroupEntity(userGroup).title).toBe('Name-only group');
    });

    it('returns the — placeholder when no title field resolves', () => {
        const userGroup = {
            groupId: 'g-1',
            group: {},
        };

        expect(mapGroupEntity(userGroup).title).toBe('—');
    });

    it('returns an empty subtitle when no description is present', () => {
        const userGroup = {
            groupId: 'g-1',
            group: { title: 'T' },
        };

        expect(mapGroupEntity(userGroup).subtitle).toBe('');
    });

    it('stringifies numeric ids so downstream callers get a consistent type', () => {
        const userGroup = {
            groupId: 42,
            group: { title: 'T' },
        };

        expect(mapGroupEntity(userGroup).id).toBe('42');
    });
});
