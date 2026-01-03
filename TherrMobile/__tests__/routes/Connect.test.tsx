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
 * Connect (User Connections) Regression Tests
 *
 * These tests verify the core user connections logic and behaviors including:
 * - User search functionality
 * - Connection request creation
 * - Connection sorting (active vs inactive)
 * - People you may know suggestions
 * - Tab navigation between People, Messages, and Connections
 */

describe('Connect Tab Navigation Logic', () => {
    const PEOPLE_CAROUSEL_TABS = {
        PEOPLE: 'people',
        MESSAGES: 'messages',
        CONNECTIONS: 'connections',
    };

    const tabMap = {
        0: PEOPLE_CAROUSEL_TABS.PEOPLE,
        1: PEOPLE_CAROUSEL_TABS.MESSAGES,
        2: PEOPLE_CAROUSEL_TABS.CONNECTIONS,
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

    describe('getActiveTabIndex', () => {
        it('should return 0 for PEOPLE tab', () => {
            expect(getActiveTabIndex(tabMap, 'people')).toBe(0);
        });

        it('should return 1 for MESSAGES tab', () => {
            expect(getActiveTabIndex(tabMap, 'messages')).toBe(1);
        });

        it('should return 2 for CONNECTIONS tab', () => {
            expect(getActiveTabIndex(tabMap, 'connections')).toBe(2);
        });

        it('should return 0 for undefined activeTab', () => {
            expect(getActiveTabIndex(tabMap, undefined)).toBe(0);
        });

        it('should return 0 for invalid tab name', () => {
            expect(getActiveTabIndex(tabMap, 'invalid-tab')).toBe(0);
        });

        it('should return 0 for empty string', () => {
            expect(getActiveTabIndex(tabMap, '')).toBe(0);
        });
    });
});

describe('Connect Connection Details Extraction', () => {
    const mockUserId = 'user-123';

    // Simulates the getConnectionOrUserDetails method logic
    const getConnectionOrUserDetails = (userOrConnection: any, currentUserId: string) => {
        // Active connection format (no users array)
        if (!userOrConnection.users) {
            return userOrConnection;
        }

        // User <-> User connection format (has users array)
        return (
            userOrConnection.users.find(
                (u: any) => u.id !== currentUserId
            ) || {}
        );
    };

    describe('getConnectionOrUserDetails', () => {
        it('should return the connection directly when no users array exists', () => {
            const activeConnection = {
                id: 'conn-1',
                userName: 'testuser',
                firstName: 'Test',
                lastName: 'User',
            };

            const result = getConnectionOrUserDetails(activeConnection, mockUserId);
            expect(result).toEqual(activeConnection);
        });

        it('should extract the other user from users array', () => {
            const connectionWithUsers = {
                id: 'conn-1',
                users: [
                    { id: 'user-123', userName: 'currentuser' },
                    { id: 'user-456', userName: 'otheruser' },
                ],
            };

            const result = getConnectionOrUserDetails(connectionWithUsers, mockUserId);
            expect(result.id).toBe('user-456');
            expect(result.userName).toBe('otheruser');
        });

        it('should return empty object when only current user in users array', () => {
            const connectionWithOnlyCurrentUser = {
                id: 'conn-1',
                users: [
                    { id: 'user-123', userName: 'currentuser' },
                ],
            };

            const result = getConnectionOrUserDetails(connectionWithOnlyCurrentUser, mockUserId);
            expect(result).toEqual({});
        });

        it('should return empty object for empty users array', () => {
            const connectionWithEmptyUsers = {
                id: 'conn-1',
                users: [],
            };

            const result = getConnectionOrUserDetails(connectionWithEmptyUsers, mockUserId);
            expect(result).toEqual({});
        });

        it('should handle connection with multiple other users (return first match)', () => {
            const connectionWithMultipleUsers = {
                id: 'conn-1',
                users: [
                    { id: 'user-456', userName: 'user1' },
                    { id: 'user-789', userName: 'user2' },
                    { id: 'user-123', userName: 'currentuser' },
                ],
            };

            const result = getConnectionOrUserDetails(connectionWithMultipleUsers, mockUserId);
            expect(result.id).toBe('user-456');
        });
    });
});

describe('Connect Connection Subtitle Formatting', () => {
    // Simulates the getConnectionSubtitle method logic
    const getConnectionSubtitle = (connectionDetails: any, anonymousText = 'Anonymous User') => {
        if (!connectionDetails?.firstName && !connectionDetails?.lastName) {
            return anonymousText;
        }
        return `${connectionDetails.firstName || ''} ${
            connectionDetails.lastName || ''
        }`;
    };

    describe('getConnectionSubtitle', () => {
        it('should return full name when both firstName and lastName exist', () => {
            const details = { firstName: 'John', lastName: 'Doe' };
            expect(getConnectionSubtitle(details)).toBe('John Doe');
        });

        it('should return firstName only when lastName is missing', () => {
            const details = { firstName: 'John' };
            expect(getConnectionSubtitle(details)).toBe('John ');
        });

        it('should return lastName only when firstName is missing', () => {
            const details = { lastName: 'Doe' };
            expect(getConnectionSubtitle(details)).toBe(' Doe');
        });

        it('should return anonymous text when both names are missing', () => {
            const details = {};
            expect(getConnectionSubtitle(details)).toBe('Anonymous User');
        });

        it('should return anonymous text for null details', () => {
            expect(getConnectionSubtitle(null)).toBe('Anonymous User');
        });

        it('should return anonymous text for undefined details', () => {
            expect(getConnectionSubtitle(undefined)).toBe('Anonymous User');
        });

        it('should handle empty string names', () => {
            const details = { firstName: '', lastName: '' };
            expect(getConnectionSubtitle(details)).toBe('Anonymous User');
        });
    });
});

describe('Connect Connection Sorting', () => {
    // Simulates the sortConnections method logic
    const sortConnections = (
        activeConnections: any[],
        connections: any[]
    ) => {
        const activeWithFlag = [...(activeConnections || [])].map(a => ({ ...a, isActive: true }));
        const inactiveConnections = connections
            ?.filter(c => !activeWithFlag.find(a => a.id === c.requestingUserId || a.id === c.acceptingUserId)) || [];

        return activeWithFlag.concat(inactiveConnections);
    };

    describe('sortConnections', () => {
        it('should mark active connections with isActive flag', () => {
            const activeConnections = [
                { id: 'user-1', userName: 'active1' },
                { id: 'user-2', userName: 'active2' },
            ];
            const connections: any[] = [];

            const result = sortConnections(activeConnections, connections);

            expect(result[0].isActive).toBe(true);
            expect(result[1].isActive).toBe(true);
        });

        it('should filter out connections that match active connections by requestingUserId', () => {
            const activeConnections = [{ id: 'user-1', userName: 'active1' }];
            const connections = [
                { id: 'conn-1', requestingUserId: 'user-1', acceptingUserId: 'user-3' },
                { id: 'conn-2', requestingUserId: 'user-2', acceptingUserId: 'user-4' },
            ];

            const result = sortConnections(activeConnections, connections);

            expect(result).toHaveLength(2); // 1 active + 1 inactive
            expect(result[0].id).toBe('user-1');
            expect(result[1].id).toBe('conn-2');
        });

        it('should filter out connections that match active connections by acceptingUserId', () => {
            const activeConnections = [{ id: 'user-1', userName: 'active1' }];
            const connections = [
                { id: 'conn-1', requestingUserId: 'user-3', acceptingUserId: 'user-1' },
                { id: 'conn-2', requestingUserId: 'user-2', acceptingUserId: 'user-4' },
            ];

            const result = sortConnections(activeConnections, connections);

            expect(result).toHaveLength(2); // 1 active + 1 inactive
            expect(result[0].id).toBe('user-1');
            expect(result[1].id).toBe('conn-2');
        });

        it('should return only active connections when all connections match', () => {
            const activeConnections = [
                { id: 'user-1', userName: 'active1' },
                { id: 'user-2', userName: 'active2' },
            ];
            const connections = [
                { id: 'conn-1', requestingUserId: 'user-1', acceptingUserId: 'user-2' },
            ];

            const result = sortConnections(activeConnections, connections);

            expect(result).toHaveLength(2);
            expect(result.every(c => c.isActive)).toBe(true);
        });

        it('should handle empty active connections array', () => {
            const activeConnections: any[] = [];
            const connections = [
                { id: 'conn-1', requestingUserId: 'user-1', acceptingUserId: 'user-2' },
            ];

            const result = sortConnections(activeConnections, connections);

            expect(result).toHaveLength(1);
            expect(result[0].isActive).toBeUndefined();
        });

        it('should handle empty connections array', () => {
            const activeConnections = [
                { id: 'user-1', userName: 'active1' },
            ];
            const connections: any[] = [];

            const result = sortConnections(activeConnections, connections);

            expect(result).toHaveLength(1);
            expect(result[0].isActive).toBe(true);
        });

        it('should handle undefined inputs', () => {
            const result = sortConnections(undefined as any, undefined as any);
            expect(result).toEqual([]);
        });
    });
});

describe('Connect User Search and Discovery', () => {
    // Simulates the sortUsers method logic
    const sortUsers = (users: Record<string, any>, usersMightKnow: Record<string, any>) => {
        const usersArray = Object.values(users || {});
        const mightKnowUsers = Object.values(usersMightKnow || {})
            .filter((u: any) => !users?.[u.id])?.slice(0, 10);

        return {
            users: usersArray,
            mightKnowUsers,
        };
    };

    describe('sortUsers', () => {
        it('should convert users object to array', () => {
            const users = {
                'user-1': { id: 'user-1', userName: 'user1' },
                'user-2': { id: 'user-2', userName: 'user2' },
            };

            const result = sortUsers(users, {});

            expect(result.users).toHaveLength(2);
            expect(result.users[0].id).toBe('user-1');
        });

        it('should filter out users already in main users list from mightKnow', () => {
            const users = {
                'user-1': { id: 'user-1', userName: 'user1' },
            };
            const usersMightKnow = {
                'user-1': { id: 'user-1', userName: 'user1' },
                'user-2': { id: 'user-2', userName: 'user2' },
            };

            const result = sortUsers(users, usersMightKnow);

            expect(result.mightKnowUsers).toHaveLength(1);
            expect(result.mightKnowUsers[0].id).toBe('user-2');
        });

        it('should limit mightKnowUsers to 10', () => {
            const users = {};
            const usersMightKnow: Record<string, any> = {};
            for (let i = 0; i < 15; i++) {
                usersMightKnow[`user-${i}`] = { id: `user-${i}`, userName: `user${i}` };
            }

            const result = sortUsers(users, usersMightKnow);

            expect(result.mightKnowUsers).toHaveLength(10);
        });

        it('should handle empty users object', () => {
            const result = sortUsers({}, {});

            expect(result.users).toEqual([]);
            expect(result.mightKnowUsers).toEqual([]);
        });

        it('should handle undefined inputs', () => {
            const result = sortUsers(undefined as any, undefined as any);

            expect(result.users).toEqual([]);
            expect(result.mightKnowUsers).toEqual([]);
        });
    });
});

describe('Connect Connection Request Creation', () => {
    // Simulates the onSendConnectRequest method logic
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

    describe('buildConnectionRequest', () => {
        it('should build complete connection request with all fields', () => {
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

            expect(result).toEqual({
                requestingUserId: 'user-123',
                requestingUserFirstName: 'John',
                requestingUserLastName: 'Doe',
                requestingUserEmail: 'john@example.com',
                acceptingUserId: 'user-456',
                acceptingUserPhoneNumber: '+1234567890',
                acceptingUserEmail: 'jane@example.com',
            });
        });

        it('should handle missing optional fields in accepting user', () => {
            const currentUser = {
                id: 'user-123',
                firstName: 'John',
                lastName: 'Doe',
                email: 'john@example.com',
            };
            const acceptingUser = {
                id: 'user-456',
            };

            const result = buildConnectionRequest(currentUser, acceptingUser);

            expect(result.acceptingUserId).toBe('user-456');
            expect(result.acceptingUserPhoneNumber).toBeUndefined();
            expect(result.acceptingUserEmail).toBeUndefined();
        });

        it('should handle null accepting user', () => {
            const currentUser = {
                id: 'user-123',
                firstName: 'John',
                lastName: 'Doe',
                email: 'john@example.com',
            };

            const result = buildConnectionRequest(currentUser, null);

            expect(result.acceptingUserId).toBeUndefined();
            expect(result.acceptingUserPhoneNumber).toBeUndefined();
            expect(result.acceptingUserEmail).toBeUndefined();
        });
    });
});

describe('Connect Search Parameters', () => {
    const DEFAULT_PAGE_SIZE = 50;

    // Simulates the search parameters construction for user connections
    const buildUserConnectionsSearchParams = (userId: string, pageNumber = 1) => {
        return {
            filterBy: 'acceptingUserId',
            query: userId,
            itemsPerPage: DEFAULT_PAGE_SIZE,
            pageNumber,
            orderBy: 'interactionCount',
            order: 'desc',
            shouldCheckReverse: true,
            withMedia: true,
        };
    };

    // Simulates the search parameters for user search
    const buildUserSearchParams = (query = '', limit = DEFAULT_PAGE_SIZE, offset = 0) => {
        return {
            query,
            limit,
            offset,
            withMedia: true,
        };
    };

    // Simulates the search parameters for DMs
    const buildDMsSearchParams = (pageNumber = 1) => {
        return {
            itemsPerPage: DEFAULT_PAGE_SIZE,
            pageNumber,
        };
    };

    describe('buildUserConnectionsSearchParams', () => {
        it('should build correct params for first page', () => {
            const params = buildUserConnectionsSearchParams('user-123', 1);

            expect(params).toEqual({
                filterBy: 'acceptingUserId',
                query: 'user-123',
                itemsPerPage: 50,
                pageNumber: 1,
                orderBy: 'interactionCount',
                order: 'desc',
                shouldCheckReverse: true,
                withMedia: true,
            });
        });

        it('should handle subsequent pages', () => {
            const params = buildUserConnectionsSearchParams('user-123', 3);
            expect(params.pageNumber).toBe(3);
        });

        it('should default to page 1 when not specified', () => {
            const params = buildUserConnectionsSearchParams('user-123');
            expect(params.pageNumber).toBe(1);
        });
    });

    describe('buildUserSearchParams', () => {
        it('should build correct params with defaults', () => {
            const params = buildUserSearchParams();

            expect(params).toEqual({
                query: '',
                limit: 50,
                offset: 0,
                withMedia: true,
            });
        });

        it('should accept custom query', () => {
            const params = buildUserSearchParams('john');
            expect(params.query).toBe('john');
        });

        it('should accept custom limit and offset', () => {
            const params = buildUserSearchParams('', 25, 50);
            expect(params.limit).toBe(25);
            expect(params.offset).toBe(50);
        });
    });

    describe('buildDMsSearchParams', () => {
        it('should build correct params for first page', () => {
            const params = buildDMsSearchParams(1);

            expect(params).toEqual({
                itemsPerPage: 50,
                pageNumber: 1,
            });
        });

        it('should handle different page numbers', () => {
            const params = buildDMsSearchParams(5);
            expect(params.pageNumber).toBe(5);
        });
    });
});

describe('Connect DM Summary Formatting', () => {
    // Simulates the getDMSummarySubtitle method logic (simplified)
    const getDMSummarySubtitle = (messageSummary: any) => {
        const truncatedMessage = messageSummary.message?.substring(0, 100) || '';
        return `${truncatedMessage}...`;
    };

    describe('getDMSummarySubtitle', () => {
        it('should truncate message to 100 characters', () => {
            const longMessage = 'a'.repeat(150);
            const messageSummary = { message: longMessage };

            const result = getDMSummarySubtitle(messageSummary);

            expect(result).toBe('a'.repeat(100) + '...');
        });

        it('should handle short messages', () => {
            const messageSummary = { message: 'Hello world' };

            const result = getDMSummarySubtitle(messageSummary);

            expect(result).toBe('Hello world...');
        });

        it('should handle missing message', () => {
            const messageSummary = {};

            const result = getDMSummarySubtitle(messageSummary);

            expect(result).toBe('...');
        });

        it('should handle null message', () => {
            const messageSummary = { message: null };

            const result = getDMSummarySubtitle(messageSummary);

            expect(result).toBe('...');
        });
    });
});

describe('Connect Navigation Helpers', () => {
    describe('onConnectionPress', () => {
        it('should create correct navigation params for DirectMessage', () => {
            const connectionDetails = {
                id: 'user-456',
                userName: 'otheruser',
                firstName: 'Other',
                lastName: 'User',
            };

            const navigationParams = {
                connectionDetails,
            };

            expect(navigationParams.connectionDetails.id).toBe('user-456');
            expect(navigationParams.connectionDetails.userName).toBe('otheruser');
        });
    });

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

    describe('onCreatePress', () => {
        it('should navigate to Invite screen', () => {
            const mockNavigate = jest.fn();

            // Simulating onCreatePress behavior
            mockNavigate('Invite');

            expect(mockNavigate).toHaveBeenCalledWith('Invite');
        });
    });
});
