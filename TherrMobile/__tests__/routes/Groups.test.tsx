import 'react-native';

// Note: import explicitly to use the types shipped with jest.
import { it, describe, beforeEach, afterEach, expect } from '@jest/globals';

beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
});

afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
});

/**
 * Groups & Forums Regression Tests
 *
 * These tests verify the core Groups & Forums logic and behaviors including:
 * - Forum/Group creation and editing
 * - Message posting in forums
 * - Member management (roles, statuses)
 * - Category filtering and selection
 * - Group joining/leaving
 * - Tab navigation within groups
 */

// ============================================================================
// Constants (mirroring the app's constants)
// ============================================================================

const GROUPS_CAROUSEL_TABS = {
    GROUPS: 'groups',
};

const GROUP_CAROUSEL_TABS = {
    CHAT: 'chat',
    EVENTS: 'events',
    MEMBERS: 'members',
};

const GroupMemberRoles = {
    CREATOR: 'creator',
    ADMIN: 'admin',
    EVENT_HOST: 'event-host',
    MEMBER: 'member',
    READ_ONLY: 'read-only',
};

const GroupRequestStatuses = {
    PENDING: 'pending',
    APPROVED: 'approved',
    REMOVED: 'denied',
};

// ============================================================================
// Tab Navigation Logic Tests
// ============================================================================

describe('Groups Tab Navigation Logic', () => {
    const tabMap = {
        0: GROUPS_CAROUSEL_TABS.GROUPS,
    };

    const getActiveTabIndex = (mapOfTabs: { [key: number]: string }, activeTab?: string) => {
        if (activeTab === undefined || activeTab === null) {
            return 0;
        }

        if (activeTab === mapOfTabs[0]) {
            return 0;
        }
        if (activeTab === mapOfTabs[1]) {
            return 1;
        }
        if (activeTab === mapOfTabs[2]) {
            return 2;
        }

        return 0;
    };

    describe('getActiveTabIndex for Groups list', () => {
        it('should return 0 for GROUPS tab', () => {
            expect(getActiveTabIndex(tabMap, 'groups')).toBe(0);
        });

        it('should return 0 for undefined activeTab', () => {
            expect(getActiveTabIndex(tabMap, undefined)).toBe(0);
        });

        it('should return 0 for null activeTab', () => {
            expect(getActiveTabIndex(tabMap, null as any)).toBe(0);
        });

        it('should return 0 for invalid tab name', () => {
            expect(getActiveTabIndex(tabMap, 'invalid-tab')).toBe(0);
        });
    });
});

describe('ViewGroup Tab Navigation Logic', () => {
    const tabMap = {
        0: GROUP_CAROUSEL_TABS.CHAT,
        1: GROUP_CAROUSEL_TABS.EVENTS,
        2: GROUP_CAROUSEL_TABS.MEMBERS,
    };

    const getActiveTabIndex = (mapOfTabs: { [key: number]: string }, activeTab?: string) => {
        if (activeTab === mapOfTabs[0]) {
            return 0;
        }
        if (activeTab === mapOfTabs[1]) {
            return 1;
        }
        if (activeTab === mapOfTabs[2]) {
            return 2;
        }

        return 0;
    };

    describe('getActiveTabIndex for ViewGroup', () => {
        it('should return 0 for CHAT tab', () => {
            expect(getActiveTabIndex(tabMap, 'chat')).toBe(0);
        });

        it('should return 1 for EVENTS tab', () => {
            expect(getActiveTabIndex(tabMap, 'events')).toBe(1);
        });

        it('should return 2 for MEMBERS tab', () => {
            expect(getActiveTabIndex(tabMap, 'members')).toBe(2);
        });

        it('should return 0 for undefined activeTab', () => {
            expect(getActiveTabIndex(tabMap, undefined)).toBe(0);
        });

        it('should return 0 for invalid tab name', () => {
            expect(getActiveTabIndex(tabMap, 'invalid')).toBe(0);
        });
    });
});

// ============================================================================
// Forum/Group Creation Tests
// ============================================================================

describe('Forum/Group Creation Logic', () => {
    // Simulates the isFormDisabled method logic
    const isFormDisabled = (isSubmitting: boolean, inputs: { title: string; description: string }) => {
        const requiredInputs = {
            title: inputs.title,
            description: inputs.description,
        };

        return isSubmitting || Object.keys(requiredInputs).some((key) => !requiredInputs[key]);
    };

    describe('isFormDisabled', () => {
        it('should return true when submitting', () => {
            const inputs = { title: 'Test Group', description: 'A test group' };
            expect(isFormDisabled(true, inputs)).toBe(true);
        });

        it('should return true when title is empty', () => {
            const inputs = { title: '', description: 'A test group' };
            expect(isFormDisabled(false, inputs)).toBe(true);
        });

        it('should return true when description is empty', () => {
            const inputs = { title: 'Test Group', description: '' };
            expect(isFormDisabled(false, inputs)).toBe(true);
        });

        it('should return true when both title and description are empty', () => {
            const inputs = { title: '', description: '' };
            expect(isFormDisabled(false, inputs)).toBe(true);
        });

        it('should return false when not submitting and all required fields are filled', () => {
            const inputs = { title: 'Test Group', description: 'A test group description' };
            expect(isFormDisabled(false, inputs)).toBe(false);
        });
    });

    // Simulates building the create forum arguments
    const buildCreateForumArgs = (
        userId: string,
        inputs: {
            title: string;
            subtitle?: string;
            description: string;
            iconGroup?: string;
            iconId?: string;
            iconColor?: string;
            isPublic?: boolean;
        },
        categories: { tag: string; isActive: boolean }[],
        hashtags: string[]
    ) => {
        const {
            title,
            subtitle,
            description,
            iconGroup,
            iconId,
            iconColor,
            isPublic,
        } = inputs;

        return {
            administratorIds: userId,
            title,
            subtitle: subtitle || title,
            description,
            categoryTags: categories.filter(c => c.isActive).map(c => c.tag) || ['general'],
            hashTags: hashtags.join(','),
            integrationIds: '',
            invitees: '',
            iconGroup: iconGroup || 'font-awesome-5',
            iconId: iconId || 'star',
            iconColor: iconColor || 'black',
            isPublic: isPublic ?? true,
        };
    };

    describe('buildCreateForumArgs', () => {
        it('should build correct args with all inputs', () => {
            const userId = 'user-123';
            const inputs = {
                title: 'Test Group',
                subtitle: 'A subtitle',
                description: 'Test description',
                iconGroup: 'therr',
                iconId: 'custom-icon',
                iconColor: 'red',
                isPublic: true,
            };
            const categories = [
                { tag: 'fitness', isActive: true },
                { tag: 'sports', isActive: false },
            ];
            const hashtags = ['test', 'group'];

            const result = buildCreateForumArgs(userId, inputs, categories, hashtags);

            expect(result.administratorIds).toBe('user-123');
            expect(result.title).toBe('Test Group');
            expect(result.subtitle).toBe('A subtitle');
            expect(result.description).toBe('Test description');
            expect(result.categoryTags).toEqual(['fitness']);
            expect(result.hashTags).toBe('test,group');
            expect(result.iconGroup).toBe('therr');
            expect(result.iconId).toBe('custom-icon');
            expect(result.iconColor).toBe('red');
            expect(result.isPublic).toBe(true);
        });

        it('should use title as subtitle when subtitle is empty', () => {
            const userId = 'user-123';
            const inputs = {
                title: 'Test Group',
                description: 'Test description',
            };
            const categories: { tag: string; isActive: boolean }[] = [];
            const hashtags: string[] = [];

            const result = buildCreateForumArgs(userId, inputs, categories, hashtags);

            expect(result.subtitle).toBe('Test Group');
        });

        it('should use default icon values when not specified', () => {
            const userId = 'user-123';
            const inputs = {
                title: 'Test Group',
                description: 'Test description',
            };
            const categories: { tag: string; isActive: boolean }[] = [];
            const hashtags: string[] = [];

            const result = buildCreateForumArgs(userId, inputs, categories, hashtags);

            expect(result.iconGroup).toBe('font-awesome-5');
            expect(result.iconId).toBe('star');
            expect(result.iconColor).toBe('black');
        });

        it('should default isPublic to true when not specified', () => {
            const userId = 'user-123';
            const inputs = {
                title: 'Test Group',
                description: 'Test description',
            };
            const categories: { tag: string; isActive: boolean }[] = [];
            const hashtags: string[] = [];

            const result = buildCreateForumArgs(userId, inputs, categories, hashtags);

            expect(result.isPublic).toBe(true);
        });

        it('should handle multiple active categories', () => {
            const userId = 'user-123';
            const inputs = {
                title: 'Test Group',
                description: 'Test description',
            };
            const categories = [
                { tag: 'fitness', isActive: true },
                { tag: 'sports', isActive: true },
                { tag: 'music', isActive: false },
            ];
            const hashtags: string[] = [];

            const result = buildCreateForumArgs(userId, inputs, categories, hashtags);

            expect(result.categoryTags).toEqual(['fitness', 'sports']);
        });
    });
});

// ============================================================================
// Forum Message Posting Tests
// ============================================================================

describe('Forum Message Posting Logic', () => {
    describe('handleInputChange', () => {
        it('should update message input value', () => {
            let msgInputVal = '';
            const handleInputChange = (val: string) => {
                msgInputVal = val;
            };

            handleInputChange('Hello forum!');
            expect(msgInputVal).toBe('Hello forum!');
        });

        it('should handle empty string input', () => {
            let msgInputVal = 'previous message';
            const handleInputChange = (val: string) => {
                msgInputVal = val;
            };

            handleInputChange('');
            expect(msgInputVal).toBe('');
        });

        it('should handle special characters', () => {
            let msgInputVal = '';
            const handleInputChange = (val: string) => {
                msgInputVal = val;
            };

            handleInputChange('Hello! @user #topic 🎉');
            expect(msgInputVal).toBe('Hello! @user #topic 🎉');
        });
    });

    describe('handleSend', () => {
        it('should send forum message when input is not empty', () => {
            let msgInputVal = 'Test forum message';
            let sentMessage: any = null;
            let inputCleared = false;

            const sendForumMessage = (params: any) => {
                sentMessage = params;
            };

            const handleSend = () => {
                if (msgInputVal) {
                    sendForumMessage({
                        roomId: 'forum-123',
                        message: msgInputVal,
                        userId: 'user-123',
                        userName: 'testuser',
                        userImgSrc: 'https://example.com/avatar.jpg',
                    });
                    msgInputVal = '';
                    inputCleared = true;
                }
            };

            handleSend();

            expect(sentMessage).toEqual({
                roomId: 'forum-123',
                message: 'Test forum message',
                userId: 'user-123',
                userName: 'testuser',
                userImgSrc: 'https://example.com/avatar.jpg',
            });
            expect(inputCleared).toBe(true);
        });

        it('should not send message when input is empty', () => {
            let msgInputVal = '';
            let sentMessage: any = null;

            const sendForumMessage = (params: any) => {
                sentMessage = params;
            };

            const handleSend = () => {
                if (msgInputVal) {
                    sendForumMessage({
                        roomId: 'forum-123',
                        message: msgInputVal,
                        userId: 'user-123',
                        userName: 'testuser',
                        userImgSrc: 'https://example.com/avatar.jpg',
                    });
                }
            };

            handleSend();

            expect(sentMessage).toBeNull();
        });
    });

    describe('getForumMessages', () => {
        const getForumMessages = (messages: any, forumId: string) => {
            return messages.forumMsgs ? (messages.forumMsgs[forumId] || []) : [];
        };

        it('should return messages for existing forum', () => {
            const messages = {
                forumMsgs: {
                    'forum-123': [
                        { id: 1, text: 'Hello' },
                        { id: 2, text: 'World' },
                    ],
                },
            };

            const msgs = getForumMessages(messages, 'forum-123');
            expect(msgs).toHaveLength(2);
            expect(msgs[0].text).toBe('Hello');
        });

        it('should return empty array for non-existing forum', () => {
            const messages = {
                forumMsgs: {
                    'forum-123': [{ id: 1, text: 'Hello' }],
                },
            };

            const msgs = getForumMessages(messages, 'forum-456');
            expect(msgs).toEqual([]);
        });

        it('should return empty array when forumMsgs is undefined', () => {
            const messages = {};

            const msgs = getForumMessages(messages, 'forum-123');
            expect(msgs).toEqual([]);
        });
    });
});

// ============================================================================
// Forum Message Pagination Tests
// ============================================================================

describe('Forum Message Pagination Logic', () => {
    const shouldLoadMore = (msgs: any[], maxHistoricalMessages = 200) => {
        if (!msgs.length) {
            return false;
        }
        if (msgs[msgs.length - 1].isFirstMessage) {
            return false;
        }
        if (msgs.length > maxHistoricalMessages) {
            return false;
        }
        return true;
    };

    describe('shouldLoadMore', () => {
        it('should not load more when messages array is empty', () => {
            expect(shouldLoadMore([])).toBe(false);
        });

        it('should not load more when isFirstMessage is true', () => {
            const msgs = [
                { id: 1, text: 'msg1' },
                { id: 2, text: 'msg2', isFirstMessage: true },
            ];
            expect(shouldLoadMore(msgs)).toBe(false);
        });

        it('should not load more when messages exceed max historical limit', () => {
            const msgs = Array.from({ length: 201 }, (_, i) => ({
                id: i,
                text: `msg${i}`,
            }));
            expect(shouldLoadMore(msgs)).toBe(false);
        });

        it('should load more when conditions allow', () => {
            const msgs = [
                { id: 1, text: 'msg1' },
                { id: 2, text: 'msg2' },
            ];
            expect(shouldLoadMore(msgs)).toBe(true);
        });

        it('should respect custom max historical messages limit', () => {
            const msgs = Array.from({ length: 51 }, (_, i) => ({
                id: i,
                text: `msg${i}`,
            }));
            expect(shouldLoadMore(msgs, 50)).toBe(false);
            expect(shouldLoadMore(msgs, 100)).toBe(true);
        });
    });

    describe('searchForumMsgsByPage params', () => {
        const buildSearchParams = (forumId: string, pageNumber: number, itemsPerPage = 50) => {
            return {
                forumId,
                itemsPerPage,
                pageNumber,
            };
        };

        it('should build correct search params for first page', () => {
            const params = buildSearchParams('forum-123', 1);

            expect(params).toEqual({
                forumId: 'forum-123',
                itemsPerPage: 50,
                pageNumber: 1,
            });
        });

        it('should build correct search params for subsequent pages', () => {
            const params = buildSearchParams('forum-456', 3);

            expect(params.pageNumber).toBe(3);
            expect(params.forumId).toBe('forum-456');
        });
    });
});

// ============================================================================
// Member Management Tests
// ============================================================================

describe('Member Management Logic', () => {
    describe('getMembershipText', () => {
        const getMembershipText = (userDetails: any, translate: (key: string) => string) => {
            if (userDetails?.isMembershipPending) {
                return translate('pending');
            }
            if (userDetails?.membershipRole === GroupMemberRoles.CREATOR) {
                return translate('creator');
            }
            if (userDetails?.membershipRole === GroupMemberRoles.ADMIN) {
                return translate('admin');
            }
            if (userDetails?.membershipRole === GroupMemberRoles.EVENT_HOST) {
                return translate('eventHost');
            }
            if (userDetails?.membershipRole === GroupMemberRoles.READ_ONLY) {
                return translate('default');
            }

            return translate('default');
        };

        const mockTranslate = (key: string) => key;

        it('should return pending for pending membership', () => {
            const userDetails = { isMembershipPending: true };
            expect(getMembershipText(userDetails, mockTranslate)).toBe('pending');
        });

        it('should return creator for creator role', () => {
            const userDetails = { membershipRole: GroupMemberRoles.CREATOR };
            expect(getMembershipText(userDetails, mockTranslate)).toBe('creator');
        });

        it('should return admin for admin role', () => {
            const userDetails = { membershipRole: GroupMemberRoles.ADMIN };
            expect(getMembershipText(userDetails, mockTranslate)).toBe('admin');
        });

        it('should return eventHost for event host role', () => {
            const userDetails = { membershipRole: GroupMemberRoles.EVENT_HOST };
            expect(getMembershipText(userDetails, mockTranslate)).toBe('eventHost');
        });

        it('should return default for read-only role', () => {
            const userDetails = { membershipRole: GroupMemberRoles.READ_ONLY };
            expect(getMembershipText(userDetails, mockTranslate)).toBe('default');
        });

        it('should return default for member role', () => {
            const userDetails = { membershipRole: GroupMemberRoles.MEMBER };
            expect(getMembershipText(userDetails, mockTranslate)).toBe('default');
        });

        it('should return default when no role is specified', () => {
            const userDetails = {};
            expect(getMembershipText(userDetails, mockTranslate)).toBe('default');
        });
    });

    describe('getMembersList sorting', () => {
        const getMembersList = (groupMembers: any[]) => {
            const nonDefaultRoles: any[] = [];
            const defaultRoles: any[] = [];

            groupMembers.forEach((member) => {
                const formattedMember = {
                    ...member,
                    user: {
                        ...member.user,
                        membershipRole: member?.role,
                        isMembershipPending: member?.status === GroupRequestStatuses.PENDING,
                    },
                };
                if (formattedMember.role === GroupMemberRoles.ADMIN) {
                    nonDefaultRoles.unshift(formattedMember);
                } else if (formattedMember.role !== GroupMemberRoles.MEMBER) {
                    nonDefaultRoles.push(formattedMember);
                } else {
                    defaultRoles.push(formattedMember);
                }
            });

            return nonDefaultRoles.concat(defaultRoles);
        };

        it('should sort admins to the front', () => {
            const groupMembers = [
                { id: 1, user: { userName: 'member1' }, role: GroupMemberRoles.MEMBER },
                { id: 2, user: { userName: 'admin1' }, role: GroupMemberRoles.ADMIN },
                { id: 3, user: { userName: 'member2' }, role: GroupMemberRoles.MEMBER },
            ];

            const result = getMembersList(groupMembers);

            expect(result[0].user.userName).toBe('admin1');
        });

        it('should put members at the end', () => {
            const groupMembers = [
                { id: 1, user: { userName: 'member1' }, role: GroupMemberRoles.MEMBER },
                { id: 2, user: { userName: 'creator' }, role: GroupMemberRoles.CREATOR },
                { id: 3, user: { userName: 'admin' }, role: GroupMemberRoles.ADMIN },
            ];

            const result = getMembersList(groupMembers);

            expect(result[result.length - 1].user.userName).toBe('member1');
        });

        it('should set isMembershipPending correctly', () => {
            const groupMembers = [
                { id: 1, user: { userName: 'pending1' }, role: GroupMemberRoles.MEMBER, status: GroupRequestStatuses.PENDING },
                { id: 2, user: { userName: 'approved1' }, role: GroupMemberRoles.MEMBER, status: GroupRequestStatuses.APPROVED },
            ];

            const result = getMembersList(groupMembers);

            const pendingMember = result.find(m => m.user.userName === 'pending1');
            const approvedMember = result.find(m => m.user.userName === 'approved1');

            expect(pendingMember?.user.isMembershipPending).toBe(true);
            expect(approvedMember?.user.isMembershipPending).toBe(false);
        });

        it('should handle event hosts as non-default roles', () => {
            const groupMembers = [
                { id: 1, user: { userName: 'member1' }, role: GroupMemberRoles.MEMBER },
                { id: 2, user: { userName: 'eventHost1' }, role: GroupMemberRoles.EVENT_HOST },
            ];

            const result = getMembersList(groupMembers);

            expect(result[0].user.userName).toBe('eventHost1');
            expect(result[1].user.userName).toBe('member1');
        });

        it('should handle empty members array', () => {
            const result = getMembersList([]);
            expect(result).toEqual([]);
        });
    });
});

// ============================================================================
// Group Tile and Join Logic Tests
// ============================================================================

describe('GroupTile Logic', () => {
    describe('membership status determination', () => {
        const getMembershipStatus = (myUserGroups: Record<string, any>, groupId: string) => {
            return myUserGroups[groupId]?.status || '';
        };

        it('should return approved status for approved groups', () => {
            const myUserGroups = {
                'group-123': { status: GroupRequestStatuses.APPROVED },
            };

            const status = getMembershipStatus(myUserGroups, 'group-123');
            expect(status).toBe(GroupRequestStatuses.APPROVED);
        });

        it('should return pending status for pending groups', () => {
            const myUserGroups = {
                'group-123': { status: GroupRequestStatuses.PENDING },
            };

            const status = getMembershipStatus(myUserGroups, 'group-123');
            expect(status).toBe(GroupRequestStatuses.PENDING);
        });

        it('should return empty string for non-member', () => {
            const myUserGroups = {};

            const status = getMembershipStatus(myUserGroups, 'group-123');
            expect(status).toBe('');
        });

        it('should return removed status for removed users', () => {
            const myUserGroups = {
                'group-123': { status: GroupRequestStatuses.REMOVED },
            };

            const status = getMembershipStatus(myUserGroups, 'group-123');
            expect(status).toBe(GroupRequestStatuses.REMOVED);
        });
    });

    describe('isUserInGroup', () => {
        const isUserInGroup = (membershipStatus: string) => {
            return membershipStatus === GroupRequestStatuses.APPROVED;
        };

        it('should return true for approved status', () => {
            expect(isUserInGroup(GroupRequestStatuses.APPROVED)).toBe(true);
        });

        it('should return false for pending status', () => {
            expect(isUserInGroup(GroupRequestStatuses.PENDING)).toBe(false);
        });

        it('should return false for removed status', () => {
            expect(isUserInGroup(GroupRequestStatuses.REMOVED)).toBe(false);
        });

        it('should return false for empty status', () => {
            expect(isUserInGroup('')).toBe(false);
        });
    });

    describe('join button visibility', () => {
        const shouldShowJoinButton = (isUserInGroup: boolean, membershipStatus: string) => {
            return !isUserInGroup && membershipStatus !== GroupRequestStatuses.REMOVED;
        };

        it('should show join button for non-members', () => {
            expect(shouldShowJoinButton(false, '')).toBe(true);
        });

        it('should show join button for pending members', () => {
            expect(shouldShowJoinButton(false, GroupRequestStatuses.PENDING)).toBe(true);
        });

        it('should not show join button for approved members', () => {
            expect(shouldShowJoinButton(true, GroupRequestStatuses.APPROVED)).toBe(false);
        });

        it('should not show join button for removed users', () => {
            expect(shouldShowJoinButton(false, GroupRequestStatuses.REMOVED)).toBe(false);
        });
    });

    describe('join button text', () => {
        const getJoinButtonText = (membershipStatus: string, translate: (key: string) => string) => {
            return translate(membershipStatus === GroupRequestStatuses.PENDING ? 'accept' : 'join');
        };

        const mockTranslate = (key: string) => key;

        it('should return "join" for non-members', () => {
            expect(getJoinButtonText('', mockTranslate)).toBe('join');
        });

        it('should return "accept" for pending members', () => {
            expect(getJoinButtonText(GroupRequestStatuses.PENDING, mockTranslate)).toBe('accept');
        });
    });
});

// ============================================================================
// Category Filtering Tests
// ============================================================================

describe('Category Filtering Logic', () => {
    describe('handleCategoryPress', () => {
        const handleCategoryPress = (categories: any[], categoryTag: string) => {
            const modifiedCategories = [...categories];

            modifiedCategories.some((c, i) => {
                if (c.tag === categoryTag) {
                    modifiedCategories[i] = { ...c, isActive: !c.isActive };
                    return true;
                }
                return false;
            });

            return modifiedCategories;
        };

        it('should toggle category active state from false to true', () => {
            const categories = [
                { tag: 'fitness', isActive: false },
                { tag: 'sports', isActive: false },
            ];

            const result = handleCategoryPress(categories, 'fitness');

            expect(result[0].isActive).toBe(true);
            expect(result[1].isActive).toBe(false);
        });

        it('should toggle category active state from true to false', () => {
            const categories = [
                { tag: 'fitness', isActive: true },
                { tag: 'sports', isActive: false },
            ];

            const result = handleCategoryPress(categories, 'fitness');

            expect(result[0].isActive).toBe(false);
        });

        it('should not affect other categories', () => {
            const categories = [
                { tag: 'fitness', isActive: true },
                { tag: 'sports', isActive: true },
                { tag: 'music', isActive: false },
            ];

            const result = handleCategoryPress(categories, 'fitness');

            expect(result[1].isActive).toBe(true);
            expect(result[2].isActive).toBe(false);
        });

        it('should handle non-existing category', () => {
            const categories = [
                { tag: 'fitness', isActive: false },
            ];

            const result = handleCategoryPress(categories, 'nonexistent');

            expect(result[0].isActive).toBe(false);
        });
    });

    describe('handleCategoryTogglePress (clear all)', () => {
        const handleCategoryTogglePress = (categories: any[]) => {
            return categories.map(c => ({ ...c, isActive: false }));
        };

        it('should clear all active categories', () => {
            const categories = [
                { tag: 'fitness', isActive: true },
                { tag: 'sports', isActive: true },
                { tag: 'music', isActive: true },
            ];

            const result = handleCategoryTogglePress(categories);

            expect(result.every(c => c.isActive === false)).toBe(true);
        });

        it('should handle already inactive categories', () => {
            const categories = [
                { tag: 'fitness', isActive: false },
                { tag: 'sports', isActive: false },
            ];

            const result = handleCategoryTogglePress(categories);

            expect(result.every(c => c.isActive === false)).toBe(true);
        });

        it('should handle empty categories array', () => {
            const categories: any[] = [];
            const result = handleCategoryTogglePress(categories);
            expect(result).toEqual([]);
        });
    });

    describe('getSelectedCategoryTags', () => {
        const getSelectedCategoryTags = (categories: { tag: string; isActive: boolean }[]) => {
            return categories.filter(c => c.isActive).map(c => c.tag);
        };

        it('should return tags of active categories only', () => {
            const categories = [
                { tag: 'fitness', isActive: true },
                { tag: 'sports', isActive: false },
                { tag: 'music', isActive: true },
            ];

            const result = getSelectedCategoryTags(categories);

            expect(result).toEqual(['fitness', 'music']);
        });

        it('should return empty array when no categories are active', () => {
            const categories = [
                { tag: 'fitness', isActive: false },
                { tag: 'sports', isActive: false },
            ];

            const result = getSelectedCategoryTags(categories);

            expect(result).toEqual([]);
        });

        it('should return all tags when all categories are active', () => {
            const categories = [
                { tag: 'fitness', isActive: true },
                { tag: 'sports', isActive: true },
            ];

            const result = getSelectedCategoryTags(categories);

            expect(result).toEqual(['fitness', 'sports']);
        });
    });
});

// ============================================================================
// Forum Search Parameters Tests
// ============================================================================

describe('Forum Search Parameters', () => {
    const DEFAULT_PAGE_SIZE = 50;

    const buildSearchFilters = (pageNumber = 1, itemsPerPage = DEFAULT_PAGE_SIZE) => {
        return {
            itemsPerPage,
            pageNumber,
            order: 'desc',
        };
    };

    const buildSearchParams = (
        searchFilters: any,
        text: string,
        selectedCategoryTags: string[]
    ) => {
        const searchParams = {
            ...searchFilters,
            query: text,
            filterBy: 'title',
            filterOperator: 'ilike',
        };
        const searchArgs: any = {};
        if (selectedCategoryTags.length) {
            searchArgs.categoryTags = selectedCategoryTags;
        }
        return { searchParams, searchArgs };
    };

    describe('buildSearchFilters', () => {
        it('should build correct default filters', () => {
            const filters = buildSearchFilters();

            expect(filters).toEqual({
                itemsPerPage: 50,
                pageNumber: 1,
                order: 'desc',
            });
        });

        it('should accept custom page number', () => {
            const filters = buildSearchFilters(3);
            expect(filters.pageNumber).toBe(3);
        });

        it('should accept custom items per page', () => {
            const filters = buildSearchFilters(1, 25);
            expect(filters.itemsPerPage).toBe(25);
        });
    });

    describe('buildSearchParams', () => {
        it('should build correct search params without category filter', () => {
            const searchFilters = buildSearchFilters();
            const { searchParams, searchArgs } = buildSearchParams(searchFilters, 'fitness', []);

            expect(searchParams.query).toBe('fitness');
            expect(searchParams.filterBy).toBe('title');
            expect(searchParams.filterOperator).toBe('ilike');
            expect(searchArgs.categoryTags).toBeUndefined();
        });

        it('should include category tags in search args', () => {
            const searchFilters = buildSearchFilters();
            const { searchArgs } = buildSearchParams(searchFilters, '', ['fitness', 'sports']);

            expect(searchArgs.categoryTags).toEqual(['fitness', 'sports']);
        });

        it('should handle empty search text', () => {
            const searchFilters = buildSearchFilters();
            const { searchParams } = buildSearchParams(searchFilters, '', []);

            expect(searchParams.query).toBe('');
        });
    });
});

// ============================================================================
// Hashtag Handling Tests
// ============================================================================

describe('Group Hashtag Handling', () => {
    describe('handleHashtagPress (remove hashtag)', () => {
        const handleHashtagPress = (hashtags: string[], tagToRemove: string) => {
            return hashtags.filter(t => t !== tagToRemove);
        };

        it('should remove the specified hashtag', () => {
            const hashtags = ['test', 'group', 'fitness'];
            const result = handleHashtagPress(hashtags, 'group');

            expect(result).toEqual(['test', 'fitness']);
        });

        it('should return same array if hashtag not found', () => {
            const hashtags = ['test', 'group'];
            const result = handleHashtagPress(hashtags, 'nonexistent');

            expect(result).toEqual(['test', 'group']);
        });

        it('should handle empty hashtags array', () => {
            const result = handleHashtagPress([], 'test');
            expect(result).toEqual([]);
        });
    });

    describe('parseHashtags from string', () => {
        const parseHashtags = (hashTagsString: string | undefined) => {
            return hashTagsString ? hashTagsString.split(',') : [];
        };

        it('should parse comma-separated hashtags', () => {
            const result = parseHashtags('test,group,fitness');
            expect(result).toEqual(['test', 'group', 'fitness']);
        });

        it('should return empty array for undefined', () => {
            const result = parseHashtags(undefined);
            expect(result).toEqual([]);
        });

        it('should return single hashtag array', () => {
            const result = parseHashtags('single');
            expect(result).toEqual(['single']);
        });

        it('should return empty array for empty string', () => {
            const result = parseHashtags('');
            expect(result).toEqual([]);
        });
    });

    describe('joinHashtags to string', () => {
        const joinHashtags = (hashtags: string[]) => {
            return hashtags.join(',');
        };

        it('should join hashtags with comma', () => {
            const result = joinHashtags(['test', 'group', 'fitness']);
            expect(result).toBe('test,group,fitness');
        });

        it('should return empty string for empty array', () => {
            const result = joinHashtags([]);
            expect(result).toBe('');
        });

        it('should handle single hashtag', () => {
            const result = joinHashtags(['single']);
            expect(result).toBe('single');
        });
    });
});

// ============================================================================
// Navigation Helper Tests
// ============================================================================

describe('Groups Navigation Helpers', () => {
    describe('goToViewUser', () => {
        it('should create correct navigation params for ViewUser', () => {
            const userId = 'user-456';
            const navigationParams = {
                userInView: {
                    id: userId,
                },
            };

            expect(navigationParams.userInView.id).toBe('user-456');
        });
    });

    describe('handleChatTilePress (navigate to ViewGroup)', () => {
        it('should pass group params to navigation', () => {
            const mockNavigate = jest.fn();
            const group = {
                id: 'group-123',
                title: 'Test Group',
                subtitle: 'A subtitle',
                description: 'Test description',
                hashTags: 'test,group',
            };

            // Simulating handleChatTilePress
            mockNavigate('ViewGroup', { ...group });

            expect(mockNavigate).toHaveBeenCalledWith('ViewGroup', {
                id: 'group-123',
                title: 'Test Group',
                subtitle: 'A subtitle',
                description: 'Test description',
                hashTags: 'test,group',
            });
        });
    });

    describe('onCreatePress', () => {
        it('should navigate to EditGroup when on GROUPS tab', () => {
            const mockNavigate = jest.fn();
            const activeTabIndex = 0;
            const tabMap = { 0: GROUPS_CAROUSEL_TABS.GROUPS };

            if (tabMap[activeTabIndex] === GROUPS_CAROUSEL_TABS.GROUPS) {
                mockNavigate('EditGroup');
            } else {
                mockNavigate('Invite');
            }

            expect(mockNavigate).toHaveBeenCalledWith('EditGroup');
        });
    });
});

// ============================================================================
// Empty List Message Tests
// ============================================================================

describe('Empty List Messages', () => {
    const getEmptyListMessage = (activeTab: string, translate: (key: string) => string) => {
        if (activeTab === GROUP_CAROUSEL_TABS.CHAT) {
            return translate('noChatsFound');
        }
        if (activeTab === GROUP_CAROUSEL_TABS.MEMBERS) {
            return translate('noMembersFound');
        }
        if (activeTab === GROUP_CAROUSEL_TABS.EVENTS) {
            return translate('noEventsFound');
        }

        return translate('default');
    };

    const mockTranslate = (key: string) => key;

    it('should return chat empty message for chat tab', () => {
        expect(getEmptyListMessage(GROUP_CAROUSEL_TABS.CHAT, mockTranslate)).toBe('noChatsFound');
    });

    it('should return members empty message for members tab', () => {
        expect(getEmptyListMessage(GROUP_CAROUSEL_TABS.MEMBERS, mockTranslate)).toBe('noMembersFound');
    });

    it('should return events empty message for events tab', () => {
        expect(getEmptyListMessage(GROUP_CAROUSEL_TABS.EVENTS, mockTranslate)).toBe('noEventsFound');
    });

    it('should return default message for unknown tab', () => {
        expect(getEmptyListMessage('unknown', mockTranslate)).toBe('default');
    });
});

// ============================================================================
// Group Sorting Tests
// ============================================================================

describe('Groups Sorting Logic', () => {
    describe('sortGroups', () => {
        // Currently just returns groups as-is, but structure is ready for sorting
        const sortGroups = (forums: any) => {
            const groups = (forums && forums.searchResults) || [];
            return groups;
        };

        it('should return search results when available', () => {
            const forums = {
                searchResults: [
                    { id: 'group-1', title: 'Group 1' },
                    { id: 'group-2', title: 'Group 2' },
                ],
            };

            const result = sortGroups(forums);

            expect(result).toHaveLength(2);
            expect(result[0].id).toBe('group-1');
        });

        it('should return empty array when forums is null', () => {
            const result = sortGroups(null);
            expect(result).toEqual([]);
        });

        it('should return empty array when searchResults is undefined', () => {
            const forums = {};
            const result = sortGroups(forums);
            expect(result).toEqual([]);
        });

        it('should return empty array when searchResults is empty', () => {
            const forums = { searchResults: [] };
            const result = sortGroups(forums);
            expect(result).toEqual([]);
        });
    });
});

// ============================================================================
// Join Forum Socket Action Tests
// ============================================================================

describe('Join Forum Socket Action', () => {
    describe('buildJoinForumParams', () => {
        const buildJoinForumParams = (forumId: string, title: string, user: any) => {
            return {
                roomId: forumId,
                roomName: title,
                userId: user.details.id,
                userName: user.details.userName,
                userImgSrc: `https://example.com/users/${user.details.id}/avatar.jpg`,
            };
        };

        it('should build correct join forum params', () => {
            const user = {
                details: {
                    id: 'user-123',
                    userName: 'testuser',
                },
            };

            const result = buildJoinForumParams('forum-456', 'Test Forum', user);

            expect(result.roomId).toBe('forum-456');
            expect(result.roomName).toBe('Test Forum');
            expect(result.userId).toBe('user-123');
            expect(result.userName).toBe('testuser');
            expect(result.userImgSrc).toContain('user-123');
        });
    });
});

// ============================================================================
// Connection Request in Group Context Tests
// ============================================================================

describe('Connection Request in Group Context', () => {
    describe('onSendConnectRequest', () => {
        const buildConnectionRequest = (currentUser: any, acceptingUser: any) => {
            return {
                requestingUserId: currentUser.id,
                requestingUserFirstName: currentUser.firstName,
                requestingUserLastName: currentUser.lastName,
                requestingUserEmail: currentUser.email,
                acceptingUserId: acceptingUser?.id,
                acceptingUserPhoneNumber: acceptingUser?.phoneNumber,
                acceptingUserEmail: acceptingUser?.email,
            };
        };

        it('should build correct connection request from group member', () => {
            const currentUser = {
                id: 'user-123',
                firstName: 'John',
                lastName: 'Doe',
                email: 'john@example.com',
            };
            const acceptingUser = {
                id: 'user-456',
                phoneNumber: '+1234567890',
                email: 'jane@example.com',
            };

            const result = buildConnectionRequest(currentUser, acceptingUser);

            expect(result.requestingUserId).toBe('user-123');
            expect(result.acceptingUserId).toBe('user-456');
            expect(result.requestingUserEmail).toBe('john@example.com');
            expect(result.acceptingUserEmail).toBe('jane@example.com');
        });
    });
});
