/**
 * @jest-environment jsdom
 */
/* eslint-disable react/display-name, import/first, import/order, import/newline-after-import, @typescript-eslint/no-var-requires */

// Mock therr-react modules
jest.mock('therr-react/redux/actions', () => ({
    ContentActions: {
        createOrUpdateSpaceReaction: jest.fn(),
    },
    MapActions: {
        getSpaceDetails: jest.fn(),
    },
}));

jest.mock('therr-react/services', () => ({
    MapsService: {
        getSpaceMoments: jest.fn().mockResolvedValue({ data: { results: [] } }),
        getSpacePairings: jest.fn().mockResolvedValue({ data: { pairings: [] } }),
        claimSpace: jest.fn().mockResolvedValue({}),
        submitPairingFeedback: jest.fn().mockResolvedValue({}),
        createMoment: jest.fn().mockResolvedValue({ data: {} }),
    },
}));

jest.mock('therr-react/types', () => ({}));

jest.mock('therr-js-utilities/constants', () => ({
    Content: {
        mediaTypes: {
            USER_IMAGE_PUBLIC: 'public',
        },
    },
}));

jest.mock('therr-react/components', () => ({
    InlineSvg: () => null,
}));

// Mock utilities
jest.mock('../../utilities/getUserContentUri', () => ({
    __esModule: true,
    default: () => 'https://example.com/image.jpg',
}));

jest.mock('../../socket-io-middleware', () => ({
    socketIO: {
        on: jest.fn(),
        emit: jest.fn(),
        connect: jest.fn(),
        disconnect: jest.fn(),
    },
}));

jest.mock('../../components/SpacesMap', () => () => null);
jest.mock('../../components/ProgressiveImage', () => () => null);

jest.mock('../../wrappers/withNavigation', () => (c: any) => c);
jest.mock('../../wrappers/withTranslation', () => (c: any) => c);

// Mock Mantine components
jest.mock('@mantine/core', () => {
    const React = require('react'); // eslint-disable-line global-require
    const stub = (name: string) => (props: any) => React.createElement('div', { 'data-testid': name, ...props }, props.children);
    return {
        ActionIcon: stub('ActionIcon'),
        Alert: stub('Alert'),
        Anchor: stub('Anchor'),
        Avatar: stub('Avatar'),
        Badge: stub('Badge'),
        Breadcrumbs: stub('Breadcrumbs'),
        Button: stub('Button'),
        Container: stub('Container'),
        Divider: stub('Divider'),
        Group: stub('Group'),
        Image: stub('Image'),
        Modal: stub('Modal'),
        Paper: stub('Paper'),
        Rating: stub('Rating'),
        SimpleGrid: stub('SimpleGrid'),
        Skeleton: stub('Skeleton'),
        Stack: stub('Stack'),
        Text: stub('Text'),
        Textarea: stub('Textarea'),
        Title: stub('Title'),
        Tooltip: stub('Tooltip'),
    };
});

const { MapsService } = require('therr-react/services');
import { ViewSpaceComponent } from '../ViewSpace';

describe('ViewSpace', () => {
    const mockNavigate = jest.fn();
    const mockGetSpaceDetails = jest.fn().mockResolvedValue({ space: { notificationMsg: 'Test Space' } });
    const mockCreateOrUpdateSpaceReaction = jest.fn().mockResolvedValue({ data: {} });

    const defaultSpace = {
        id: 'space-123',
        notificationMsg: 'Test Restaurant',
        message: 'A great place to eat',
        fromUserId: 'user-456',
        latitude: 40.7128,
        longitude: -74.0060,
        addressReadable: '123 Main St, New York',
        addressLocality: 'New York',
        category: 'categories.restaurants',
        rating: { avgRating: 4.2, totalRatings: 15 },
        isUnclaimed: false,
    };

    const buildInstance = (overrides: Record<string, any> = {}, spaceOverrides: Record<string, any> = {}) => {
        const space = { ...defaultSpace, ...spaceOverrides };
        const props = {
            navigation: { navigate: mockNavigate },
            routeParams: { spaceId: space.id },
            location: { search: '' },
            getSpaceDetails: mockGetSpaceDetails,
            createOrUpdateSpaceReaction: mockCreateOrUpdateSpaceReaction,
            content: { media: {} } as any,
            map: { spaces: { [space.id]: space } } as any,
            user: {} as any,
            locale: 'en-us',
            translate: (key: string) => key,
            ...overrides,
        };

        const instance = new ViewSpaceComponent(props as any);
        // Manually wire up props for method calls (class constructed outside React)
        (instance as any).props = props;
        return instance;
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    // =========================================================================
    // Constructor / state initialization
    // =========================================================================
    describe('constructor', () => {
        it('initializes new state fields with defaults', () => {
            const instance = buildInstance();

            expect((instance as any).state.isLoginModalOpen).toBe(false);
            expect((instance as any).state.loginModalAction).toBe('');
            expect((instance as any).state.reviewRating).toBe(0);
            expect((instance as any).state.reviewMessage).toBe('');
            expect((instance as any).state.isReviewSubmitting).toBe(false);
            expect((instance as any).state.reviewError).toBe('');
            expect((instance as any).state.reviewSuccess).toBe('');
            expect((instance as any).state.userLatitude).toBeNull();
            expect((instance as any).state.userLongitude).toBeNull();
            expect((instance as any).state.isLocationLoading).toBe(false);
            expect((instance as any).state.locationError).toBe('');
        });

        it('parses claim=true from URL search params', () => {
            const instance = buildInstance({ location: { search: '?claim=true' } });
            expect((instance as any).state.isFromClaimEmail).toBe(true);
        });

        it('defaults isFromClaimEmail to false when no claim param', () => {
            const instance = buildInstance({ location: { search: '' } });
            expect((instance as any).state.isFromClaimEmail).toBe(false);
        });
    });

    // =========================================================================
    // Bookmark
    // =========================================================================
    describe('handleBookmarkPress', () => {
        it('opens login modal when user is not authenticated', () => {
            const instance = buildInstance({ user: { isAuthenticated: false } });
            const setStateSpy = jest.spyOn(instance, 'setState' as any);

            instance.handleBookmarkPress();

            expect(setStateSpy).toHaveBeenCalledWith({
                isLoginModalOpen: true,
                loginModalAction: 'bookmark',
            });
            expect(mockCreateOrUpdateSpaceReaction).not.toHaveBeenCalled();
        });

        it('toggles bookmark on when user is authenticated and not bookmarked', () => {
            const instance = buildInstance({
                user: { isAuthenticated: true, details: { userName: 'testuser' } },
            }, { reaction: { userBookmarkCategory: null } });

            instance.handleBookmarkPress();

            expect(mockCreateOrUpdateSpaceReaction).toHaveBeenCalledWith(
                'space-123',
                expect.objectContaining({ userBookmarkCategory: 'Uncategorized', spaceId: 'space-123' }),
                'user-456',
                'testuser',
            );
        });

        it('toggles bookmark off when already bookmarked', () => {
            const instance = buildInstance({
                user: { isAuthenticated: true, details: { userName: 'testuser' } },
            }, { reaction: { userBookmarkCategory: 'Uncategorized' } });

            instance.handleBookmarkPress();

            expect(mockCreateOrUpdateSpaceReaction).toHaveBeenCalledWith(
                'space-123',
                expect.objectContaining({ userBookmarkCategory: null, spaceId: 'space-123' }),
                'user-456',
                'testuser',
            );
        });

        it('does not navigate when unauthenticated (uses modal instead)', () => {
            const instance = buildInstance({ user: { isAuthenticated: false } });

            instance.handleBookmarkPress();

            expect(mockNavigate).not.toHaveBeenCalled();
        });
    });

    // =========================================================================
    // Geolocation distance
    // =========================================================================
    describe('getDistanceToSpace', () => {
        it('returns null when user location is not set', () => {
            const instance = buildInstance();
            expect(instance.getDistanceToSpace()).toBeNull();
        });

        it('returns null when space has no coordinates', () => {
            const instance = buildInstance({}, { latitude: null, longitude: null });
            (instance as any).state.userLatitude = 40.7128;
            (instance as any).state.userLongitude = -74.0060;

            expect(instance.getDistanceToSpace()).toBeNull();
        });

        it('returns ~0 when user is at the space', () => {
            const instance = buildInstance();
            (instance as any).state.userLatitude = 40.7128;
            (instance as any).state.userLongitude = -74.0060;

            const distance = instance.getDistanceToSpace();
            expect(distance).not.toBeNull();
            expect(distance).toBeCloseTo(0, 0);
        });

        it('returns correct distance for nearby location (~1km)', () => {
            const instance = buildInstance();
            // Move user ~1km north of the space
            (instance as any).state.userLatitude = 40.7218;
            (instance as any).state.userLongitude = -74.0060;

            const distance = instance.getDistanceToSpace() as number;
            expect(distance).toBeGreaterThan(900);
            expect(distance).toBeLessThan(1100);
        });

        it('returns large distance for far-away location', () => {
            const instance = buildInstance();
            // User in London
            (instance as any).state.userLatitude = 51.5074;
            (instance as any).state.userLongitude = -0.1278;

            const distance = instance.getDistanceToSpace() as number;
            expect(distance).toBeGreaterThan(5000000); // >5000km
        });

        it('returns null when only latitude is missing from user', () => {
            const instance = buildInstance();
            (instance as any).state.userLatitude = null;
            (instance as any).state.userLongitude = -74.0060;

            expect(instance.getDistanceToSpace()).toBeNull();
        });
    });

    // =========================================================================
    // handleRequestLocation
    // =========================================================================
    describe('handleRequestLocation', () => {
        const originalGeolocation = navigator.geolocation;

        afterEach(() => {
            Object.defineProperty(navigator, 'geolocation', {
                value: originalGeolocation,
                configurable: true,
            });
        });

        it('sets error when geolocation is not supported', () => {
            Object.defineProperty(navigator, 'geolocation', {
                value: undefined,
                configurable: true,
            });

            const instance = buildInstance();
            const setStateSpy = jest.spyOn(instance, 'setState' as any);

            instance.handleRequestLocation();

            expect(setStateSpy).toHaveBeenCalledWith({
                locationError: 'pages.viewSpace.addReview.locationUnavailable',
            });
        });

        it('calls getCurrentPosition when geolocation is available', () => {
            const mockGetCurrentPosition = jest.fn();
            Object.defineProperty(navigator, 'geolocation', {
                value: { getCurrentPosition: mockGetCurrentPosition },
                configurable: true,
            });

            const instance = buildInstance();
            const setStateSpy = jest.spyOn(instance, 'setState' as any);

            instance.handleRequestLocation();

            expect(setStateSpy).toHaveBeenCalledWith({
                isLocationLoading: true,
                locationError: '',
            });
            expect(mockGetCurrentPosition).toHaveBeenCalledWith(
                expect.any(Function),
                expect.any(Function),
                expect.objectContaining({ enableHighAccuracy: true, timeout: 10000 }),
            );
        });

        it('sets user coordinates on geolocation success', () => {
            const mockGetCurrentPosition = jest.fn((success) => {
                success({ coords: { latitude: 40.71, longitude: -74.01 } });
            });
            Object.defineProperty(navigator, 'geolocation', {
                value: { getCurrentPosition: mockGetCurrentPosition },
                configurable: true,
            });

            const instance = buildInstance();
            const setStateSpy = jest.spyOn(instance, 'setState' as any);

            instance.handleRequestLocation();

            expect(setStateSpy).toHaveBeenCalledWith({
                userLatitude: 40.71,
                userLongitude: -74.01,
                isLocationLoading: false,
                locationError: '',
            });
        });

        it('sets location error on geolocation failure', () => {
            const mockGetCurrentPosition = jest.fn((_success, error) => {
                error(new Error('User denied'));
            });
            Object.defineProperty(navigator, 'geolocation', {
                value: { getCurrentPosition: mockGetCurrentPosition },
                configurable: true,
            });

            const instance = buildInstance();
            const setStateSpy = jest.spyOn(instance, 'setState' as any);

            instance.handleRequestLocation();

            expect(setStateSpy).toHaveBeenCalledWith({
                isLocationLoading: false,
                locationError: 'pages.viewSpace.addReview.locationDenied',
            });
        });
    });

    // =========================================================================
    // handleSubmitReview
    // =========================================================================
    describe('handleSubmitReview', () => {
        it('opens login modal when user is not authenticated', () => {
            const instance = buildInstance({ user: { isAuthenticated: false } });
            const setStateSpy = jest.spyOn(instance, 'setState' as any);

            instance.handleSubmitReview();

            expect(setStateSpy).toHaveBeenCalledWith({
                isLoginModalOpen: true,
                loginModalAction: 'review',
            });
        });

        it('shows error when rating is 0', () => {
            const instance = buildInstance({
                user: { isAuthenticated: true, details: { id: 'u1', userName: 'testuser' } },
            });
            (instance as any).state.reviewRating = 0;
            const setStateSpy = jest.spyOn(instance, 'setState' as any);

            instance.handleSubmitReview();

            expect(setStateSpy).toHaveBeenCalledWith({
                reviewError: 'pages.viewSpace.addReview.ratingRequired',
            });
            expect(mockCreateOrUpdateSpaceReaction).not.toHaveBeenCalled();
        });

        it('submits rating when rating is set and user is authenticated', () => {
            const instance = buildInstance({
                user: { isAuthenticated: true, details: { id: 'u1', userName: 'testuser' } },
            });
            (instance as any).state.reviewRating = 4;
            (instance as any).state.reviewMessage = '';
            (instance as any).state.userLatitude = 40.7128;
            (instance as any).state.userLongitude = -74.0060;

            instance.handleSubmitReview();

            expect(mockCreateOrUpdateSpaceReaction).toHaveBeenCalledWith(
                'space-123',
                { spaceId: 'space-123', rating: 4 },
                'user-456',
                'testuser',
            );
        });

        it('does not create moment when message is empty', () => {
            const instance = buildInstance({
                user: { isAuthenticated: true, details: { id: 'u1', userName: 'testuser' } },
            });
            (instance as any).state.reviewRating = 3;
            (instance as any).state.reviewMessage = '   ';

            instance.handleSubmitReview();

            expect(MapsService.createMoment).not.toHaveBeenCalled();
        });

        it('creates moment when message is provided', () => {
            const instance = buildInstance({
                user: { isAuthenticated: true, details: { id: 'u1', userName: 'testuser' } },
            });
            (instance as any).state.reviewRating = 5;
            (instance as any).state.reviewMessage = 'Great food!';
            (instance as any).state.userLatitude = 40.7128;
            (instance as any).state.userLongitude = -74.0060;

            instance.handleSubmitReview();

            expect(MapsService.createMoment).toHaveBeenCalledWith(
                expect.objectContaining({
                    fromUserId: expect.any(Number),
                    message: 'Great food!',
                    spaceId: 'space-123',
                    latitude: '40.7128',
                    longitude: '-74.006',
                    isPublic: true,
                }),
            );
        });

        it('sets isReviewSubmitting to true while submitting', () => {
            const instance = buildInstance({
                user: { isAuthenticated: true, details: { id: 'u1', userName: 'testuser' } },
            });
            (instance as any).state.reviewRating = 5;
            const setStateSpy = jest.spyOn(instance, 'setState' as any);

            instance.handleSubmitReview();

            expect(setStateSpy).toHaveBeenCalledWith({
                isReviewSubmitting: true,
                reviewError: '',
                reviewSuccess: '',
            });
        });

        it('resets form and shows success after submission completes', async () => {
            mockCreateOrUpdateSpaceReaction.mockResolvedValue({ data: {} });

            const instance = buildInstance({
                user: { isAuthenticated: true, details: { id: 'u1', userName: 'testuser' } },
            });
            (instance as any).state.reviewRating = 4;
            (instance as any).state.reviewMessage = '';

            // Mock setState to actually update state
            const setStateCalls: any[] = [];
            jest.spyOn(instance, 'setState' as any).mockImplementation((update: any) => {
                setStateCalls.push(update);
            });

            // Mock fetchSpaceMoments to avoid side effects
            instance.fetchSpaceMoments = jest.fn();

            instance.handleSubmitReview();

            // Wait for Promise.all to resolve
            await new Promise((r) => { setTimeout(r, 50); });

            const successCall = setStateCalls.find((c) => c.reviewSuccess);
            expect(successCall).toEqual(expect.objectContaining({
                isReviewSubmitting: false,
                reviewSuccess: 'pages.viewSpace.addReview.successMessage',
                reviewRating: 0,
                reviewMessage: '',
            }));
        });

        it('shows error when submission fails', async () => {
            mockCreateOrUpdateSpaceReaction.mockRejectedValueOnce(new Error('Network error'));

            const instance = buildInstance({
                user: { isAuthenticated: true, details: { id: 'u1', userName: 'testuser' } },
            });
            (instance as any).state.reviewRating = 4;
            (instance as any).state.reviewMessage = '';

            const setStateCalls: any[] = [];
            jest.spyOn(instance, 'setState' as any).mockImplementation((update: any) => {
                setStateCalls.push(update);
            });

            instance.handleSubmitReview();

            await new Promise((r) => { setTimeout(r, 50); });

            const errorCall = setStateCalls.find((c) => c.reviewError);
            expect(errorCall).toEqual(expect.objectContaining({
                isReviewSubmitting: false,
                reviewError: 'pages.viewSpace.addReview.errorMessage',
            }));
        });
    });

    // =========================================================================
    // renderAddReview
    // =========================================================================
    describe('renderAddReview', () => {
        it('returns null when space has no coordinates', () => {
            const instance = buildInstance({}, { latitude: null, longitude: null });
            const result = instance.renderAddReview({ latitude: null, longitude: null });
            expect(result).toBeNull();
        });

        it('returns null when space has no longitude', () => {
            const instance = buildInstance();
            const result = instance.renderAddReview({ latitude: 40.7, longitude: null });
            expect(result).toBeNull();
        });

        it('returns JSX when space has coordinates', () => {
            const instance = buildInstance();
            const result = instance.renderAddReview(defaultSpace);
            expect(result).not.toBeNull();
        });
    });

    // =========================================================================
    // renderClaimCTA (dark mode CTA regression)
    // =========================================================================
    describe('renderClaimCTA', () => {
        it('returns null when space is not unclaimed', () => {
            const instance = buildInstance();
            (instance as any).state.claimMessageType = '';

            const result = instance.renderClaimCTA({
                ...defaultSpace,
                isUnclaimed: false,
                isClaimPending: false,
                requestedByUserId: null,
            });
            expect(result).toBeNull();
        });

        it('returns CTA when space is unclaimed', () => {
            const instance = buildInstance({ user: { isAuthenticated: false } });
            (instance as any).state.claimMessageType = '';

            const result = instance.renderClaimCTA({ ...defaultSpace, isUnclaimed: true });
            expect(result).not.toBeNull();
        });

        it('returns pending message when claim is pending', () => {
            const instance = buildInstance();
            (instance as any).state.claimMessageType = '';

            const result = instance.renderClaimCTA({
                ...defaultSpace,
                isClaimPending: true,
                isUnclaimed: false,
            });
            expect(result).not.toBeNull();
        });

        it('returns success alert when claim succeeded', () => {
            const instance = buildInstance();
            (instance as any).state.claimMessageType = 'success';
            (instance as any).state.claimMessage = 'Claim submitted';

            const result = instance.renderClaimCTA(defaultSpace);
            expect(result).not.toBeNull();
        });
    });

    // =========================================================================
    // handleClaimSpace
    // =========================================================================
    describe('handleClaimSpace', () => {
        it('navigates to register when user is not authenticated', () => {
            const instance = buildInstance({ user: { isAuthenticated: false } });

            instance.handleClaimSpace();

            expect(mockNavigate).toHaveBeenCalledWith('/register?returnTo=/spaces/space-123');
        });

        it('calls MapsService.claimSpace when user is authenticated', () => {
            const instance = buildInstance({
                user: { isAuthenticated: true, details: { id: 'u1' } },
            });

            instance.handleClaimSpace();

            expect(MapsService.claimSpace).toHaveBeenCalledWith('space-123');
        });
    });

    // =========================================================================
    // handleShare
    // =========================================================================
    describe('handleShare', () => {
        it('copies URL to clipboard when navigator.share is not available', () => {
            const mockWriteText = jest.fn().mockResolvedValue(undefined);
            Object.defineProperty(navigator, 'clipboard', {
                value: { writeText: mockWriteText },
                configurable: true,
            });
            Object.defineProperty(navigator, 'share', {
                value: undefined,
                configurable: true,
                writable: true,
            });
            Object.defineProperty(window, 'location', {
                value: { href: 'https://therr.com/spaces/space-123' },
                writable: true,
                configurable: true,
            });

            const instance = buildInstance();
            instance.handleShare();

            expect(mockWriteText).toHaveBeenCalledWith('https://therr.com/spaces/space-123');
        });
    });
});
