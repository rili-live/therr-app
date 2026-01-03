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
 * Location Tagging Regression Tests
 *
 * These tests verify the location handling logic including:
 * - Address parameter extraction and formatting
 * - Location coordinates handling
 * - Location permissions
 * - GPS status management
 * - Location disclosure flow
 */

describe('Address Parameter Handling', () => {
    interface IUnsanitizedAddress {
        addressReadable?: string;
        addressWebsite?: string;
        addressIntlPhone?: string;
        addressOpeningHours?: string[];
        addressRating?: number;
        addressNotificationMsg?: string;
    }

    interface IArea {
        addressReadable?: string;
        postalCode?: string;
        addressStreetAddress?: string;
        addressRegion?: string;
        addressLocality?: string;
        websiteUrl?: string;
        phoneNumber?: string;
        openingHours?: {
            schema: string[];
            timezone: string;
            isConfirmed: boolean;
        };
        thirdPartyRatings?: number;
        addressNotificationMsg?: string;
    }

    const addAddressParams = (area: IArea, unsanitizedAddress: IUnsanitizedAddress): IArea => {
        const modifiedArea = { ...area };

        if (unsanitizedAddress.addressReadable) {
            modifiedArea.addressReadable = unsanitizedAddress.addressReadable;

            if (unsanitizedAddress.addressReadable.endsWith('USA')) {
                const split = unsanitizedAddress.addressReadable.split(', ');
                const stateNZip = split[split.length - 2];
                const state = stateNZip.split(' ')[0];
                const zip = stateNZip.split(' ')[1];
                modifiedArea.postalCode = zip;
                modifiedArea.addressStreetAddress = split[0];
                modifiedArea.addressRegion = state;
                modifiedArea.addressLocality = split[split.length - 3];
            }
        }

        if (unsanitizedAddress.addressWebsite) {
            modifiedArea.websiteUrl = unsanitizedAddress.addressWebsite;
        }

        if (unsanitizedAddress.addressIntlPhone) {
            modifiedArea.phoneNumber = unsanitizedAddress.addressIntlPhone;
        }

        if (unsanitizedAddress.addressRating) {
            modifiedArea.thirdPartyRatings = unsanitizedAddress.addressRating;
        }

        if (unsanitizedAddress.addressNotificationMsg) {
            modifiedArea.addressNotificationMsg = unsanitizedAddress.addressNotificationMsg;
        }

        return modifiedArea;
    };

    describe('addAddressParams', () => {
        it('should add readable address', () => {
            const area: IArea = {};
            const address: IUnsanitizedAddress = {
                addressReadable: '123 Main St, New York, NY 10001, USA',
            };

            const result = addAddressParams(area, address);

            expect(result.addressReadable).toBe('123 Main St, New York, NY 10001, USA');
        });

        it('should parse US address components', () => {
            const area: IArea = {};
            const address: IUnsanitizedAddress = {
                addressReadable: '123 Main St, New York, NY 10001, USA',
            };

            const result = addAddressParams(area, address);

            expect(result.addressStreetAddress).toBe('123 Main St');
            expect(result.addressLocality).toBe('New York');
            expect(result.addressRegion).toBe('NY');
            expect(result.postalCode).toBe('10001');
        });

        it('should add website URL', () => {
            const area: IArea = {};
            const address: IUnsanitizedAddress = {
                addressWebsite: 'https://example.com',
            };

            const result = addAddressParams(area, address);

            expect(result.websiteUrl).toBe('https://example.com');
        });

        it('should add phone number', () => {
            const area: IArea = {};
            const address: IUnsanitizedAddress = {
                addressIntlPhone: '+1-555-123-4567',
            };

            const result = addAddressParams(area, address);

            expect(result.phoneNumber).toBe('+1-555-123-4567');
        });

        it('should add third party rating', () => {
            const area: IArea = {};
            const address: IUnsanitizedAddress = {
                addressRating: 4.5,
            };

            const result = addAddressParams(area, address);

            expect(result.thirdPartyRatings).toBe(4.5);
        });

        it('should add notification message', () => {
            const area: IArea = {};
            const address: IUnsanitizedAddress = {
                addressNotificationMsg: 'Best coffee in town!',
            };

            const result = addAddressParams(area, address);

            expect(result.addressNotificationMsg).toBe('Best coffee in town!');
        });

        it('should handle non-US address without parsing', () => {
            const area: IArea = {};
            const address: IUnsanitizedAddress = {
                addressReadable: '10 Downing Street, London, UK',
            };

            const result = addAddressParams(area, address);

            expect(result.addressReadable).toBe('10 Downing Street, London, UK');
            expect(result.postalCode).toBeUndefined();
        });
    });
});

describe('Location Coordinates Handling', () => {
    interface ILocationState {
        latitude?: number;
        longitude?: number;
    }

    const hasValidCoordinates = (location?: ILocationState): boolean => {
        return !!(location?.latitude && location?.longitude);
    };

    describe('hasValidCoordinates', () => {
        it('should return true for valid coordinates', () => {
            const location: ILocationState = { latitude: 40.7128, longitude: -74.006 };
            expect(hasValidCoordinates(location)).toBe(true);
        });

        it('should return false when latitude is missing', () => {
            const location: ILocationState = { longitude: -74.006 };
            expect(hasValidCoordinates(location)).toBe(false);
        });

        it('should return false when longitude is missing', () => {
            const location: ILocationState = { latitude: 40.7128 };
            expect(hasValidCoordinates(location)).toBe(false);
        });

        it('should return false for undefined location', () => {
            expect(hasValidCoordinates(undefined)).toBe(false);
        });

        it('should return false when latitude is 0', () => {
            const location: ILocationState = { latitude: 0, longitude: -74.006 };
            expect(hasValidCoordinates(location)).toBe(false);
        });

        it('should return false when longitude is 0', () => {
            const location: ILocationState = { latitude: 40.7128, longitude: 0 };
            expect(hasValidCoordinates(location)).toBe(false);
        });
    });
});

describe('Location Permissions Handling', () => {
    type PermissionStatus = 'granted' | 'denied' | 'blocked' | 'unavailable' | 'limited';

    interface IPermissions {
        location?: PermissionStatus;
        locationWhenInUse?: PermissionStatus;
        locationAlways?: PermissionStatus;
    }

    const isLocationPermissionGranted = (permissions?: IPermissions): boolean => {
        if (!permissions) {
            return false;
        }
        return (
            permissions.location === 'granted' ||
            permissions.locationWhenInUse === 'granted' ||
            permissions.locationAlways === 'granted'
        );
    };

    describe('isLocationPermissionGranted', () => {
        it('should return true when location is granted', () => {
            const permissions: IPermissions = { location: 'granted' };
            expect(isLocationPermissionGranted(permissions)).toBe(true);
        });

        it('should return true when locationWhenInUse is granted', () => {
            const permissions: IPermissions = { locationWhenInUse: 'granted' };
            expect(isLocationPermissionGranted(permissions)).toBe(true);
        });

        it('should return true when locationAlways is granted', () => {
            const permissions: IPermissions = { locationAlways: 'granted' };
            expect(isLocationPermissionGranted(permissions)).toBe(true);
        });

        it('should return false when all permissions are denied', () => {
            const permissions: IPermissions = {
                location: 'denied',
                locationWhenInUse: 'denied',
                locationAlways: 'denied',
            };
            expect(isLocationPermissionGranted(permissions)).toBe(false);
        });

        it('should return false for undefined permissions', () => {
            expect(isLocationPermissionGranted(undefined)).toBe(false);
        });

        it('should return false for empty permissions', () => {
            const permissions: IPermissions = {};
            expect(isLocationPermissionGranted(permissions)).toBe(false);
        });

        it('should return false for blocked permissions', () => {
            const permissions: IPermissions = { location: 'blocked' };
            expect(isLocationPermissionGranted(permissions)).toBe(false);
        });
    });
});

describe('GPS Status Management', () => {
    type GPSStatus = 'enabled' | 'disabled' | 'unknown';

    interface ILocationSettings {
        isGpsEnabled?: GPSStatus;
        isLocationDislosureComplete?: boolean;
    }

    const shouldShowLocationDisclosure = (settings: ILocationSettings, permissions: { granted: boolean }): boolean => {
        const gpsEnabled = settings.isGpsEnabled === 'enabled';
        const permissionsGranted = permissions.granted;
        const disclosureComplete = settings.isLocationDislosureComplete;

        return gpsEnabled && permissionsGranted && !disclosureComplete;
    };

    describe('shouldShowLocationDisclosure', () => {
        it('should return true when GPS enabled, permissions granted, but disclosure not complete', () => {
            const settings: ILocationSettings = { isGpsEnabled: 'enabled', isLocationDislosureComplete: false };
            const permissions = { granted: true };

            expect(shouldShowLocationDisclosure(settings, permissions)).toBe(true);
        });

        it('should return false when disclosure is already complete', () => {
            const settings: ILocationSettings = { isGpsEnabled: 'enabled', isLocationDislosureComplete: true };
            const permissions = { granted: true };

            expect(shouldShowLocationDisclosure(settings, permissions)).toBe(false);
        });

        it('should return false when GPS is disabled', () => {
            const settings: ILocationSettings = { isGpsEnabled: 'disabled', isLocationDislosureComplete: false };
            const permissions = { granted: true };

            expect(shouldShowLocationDisclosure(settings, permissions)).toBe(false);
        });

        it('should return false when permissions not granted', () => {
            const settings: ILocationSettings = { isGpsEnabled: 'enabled', isLocationDislosureComplete: false };
            const permissions = { granted: false };

            expect(shouldShowLocationDisclosure(settings, permissions)).toBe(false);
        });
    });
});

describe('Location Disclosure Modal Flow', () => {
    describe('Location Disclosure Selection', () => {
        type AreaType = 'moments' | 'events' | 'spaces';

        interface IDisclosureState {
            isLocationUseDisclosureModalVisible: boolean;
            locationDisclosureAreaType: AreaType;
        }

        const handleLocationDisclosureSelect = (
            state: IDisclosureState,
            selection: string,
            areaType: AreaType
        ): { updateDisclosure: boolean; toggleModal: boolean; createArea: AreaType } => {
            return {
                updateDisclosure: true,
                toggleModal: true,
                createArea: areaType,
            };
        };

        it('should return actions to update disclosure and create area', () => {
            const state: IDisclosureState = {
                isLocationUseDisclosureModalVisible: true,
                locationDisclosureAreaType: 'moments',
            };

            const result = handleLocationDisclosureSelect(state, 'accept', 'moments');

            expect(result.updateDisclosure).toBe(true);
            expect(result.toggleModal).toBe(true);
            expect(result.createArea).toBe('moments');
        });

        it('should handle events area type', () => {
            const state: IDisclosureState = {
                isLocationUseDisclosureModalVisible: true,
                locationDisclosureAreaType: 'events',
            };

            const result = handleLocationDisclosureSelect(state, 'accept', 'events');

            expect(result.createArea).toBe('events');
        });
    });

    describe('Toggle Location Use Disclosure', () => {
        it('should toggle visibility', () => {
            let isVisible = false;

            const toggleDisclosure = () => {
                isVisible = !isVisible;
            };

            toggleDisclosure();
            expect(isVisible).toBe(true);

            toggleDisclosure();
            expect(isVisible).toBe(false);
        });
    });
});

describe('Create Area with Location', () => {
    type AreaType = 'moments' | 'events' | 'spaces';

    interface ILocationState {
        user?: {
            latitude?: number;
            longitude?: number;
        };
        settings?: {
            isGpsEnabled?: string;
        };
    }

    const getCreateAreaRoute = (areaType: AreaType): string => {
        switch (areaType) {
            case 'events':
                return 'EditEvent';
            case 'spaces':
                return 'EditSpace';
            default:
                return 'EditMoment';
        }
    };

    const canCreateArea = (location: ILocationState): boolean => {
        const hasCoordinates = !!(location.user?.latitude && location.user?.longitude);
        const gpsEnabled = location.settings?.isGpsEnabled === 'enabled';
        return hasCoordinates && gpsEnabled;
    };

    describe('getCreateAreaRoute', () => {
        it('should return EditMoment for moments', () => {
            expect(getCreateAreaRoute('moments')).toBe('EditMoment');
        });

        it('should return EditEvent for events', () => {
            expect(getCreateAreaRoute('events')).toBe('EditEvent');
        });

        it('should return EditSpace for spaces', () => {
            expect(getCreateAreaRoute('spaces')).toBe('EditSpace');
        });
    });

    describe('canCreateArea', () => {
        it('should return true when location and GPS are available', () => {
            const location: ILocationState = {
                user: { latitude: 40.7128, longitude: -74.006 },
                settings: { isGpsEnabled: 'enabled' },
            };

            expect(canCreateArea(location)).toBe(true);
        });

        it('should return false when coordinates missing', () => {
            const location: ILocationState = {
                user: {},
                settings: { isGpsEnabled: 'enabled' },
            };

            expect(canCreateArea(location)).toBe(false);
        });

        it('should return false when GPS disabled', () => {
            const location: ILocationState = {
                user: { latitude: 40.7128, longitude: -74.006 },
                settings: { isGpsEnabled: 'disabled' },
            };

            expect(canCreateArea(location)).toBe(false);
        });
    });
});

describe('Navigation Reset with Location', () => {
    type AreaType = 'moments' | 'events';

    interface INavigationRoute {
        name: string;
        params: Record<string, any>;
    }

    const buildNavigationResetRoutes = (
        areaType: AreaType,
        latitude: number,
        longitude: number
    ): INavigationRoute[] => {
        const editRoute = areaType === 'events' ? 'EditEvent' : 'EditMoment';

        return [
            {
                name: 'Areas',
                params: {
                    latitude,
                    longitude,
                },
            },
            {
                name: editRoute,
                params: {
                    latitude,
                    longitude,
                    imageDetails: {},
                    area: {},
                },
            },
        ];
    };

    describe('buildNavigationResetRoutes', () => {
        it('should build routes for moment creation', () => {
            const routes = buildNavigationResetRoutes('moments', 40.7128, -74.006);

            expect(routes).toHaveLength(2);
            expect(routes[0].name).toBe('Areas');
            expect(routes[1].name).toBe('EditMoment');
            expect(routes[1].params.latitude).toBe(40.7128);
        });

        it('should build routes for event creation', () => {
            const routes = buildNavigationResetRoutes('events', 40.7128, -74.006);

            expect(routes).toHaveLength(2);
            expect(routes[1].name).toBe('EditEvent');
        });

        it('should include location in both routes', () => {
            const routes = buildNavigationResetRoutes('moments', 40.7128, -74.006);

            expect(routes[0].params.latitude).toBe(40.7128);
            expect(routes[0].params.longitude).toBe(-74.006);
            expect(routes[1].params.latitude).toBe(40.7128);
            expect(routes[1].params.longitude).toBe(-74.006);
        });
    });
});

describe('Map View Navigation with Location', () => {
    const buildMapViewParams = (latitude: number, longitude: number, shouldShowPreview = false) => {
        return {
            latitude,
            longitude,
            shouldShowPreview,
        };
    };

    describe('buildMapViewParams', () => {
        it('should build params with coordinates', () => {
            const params = buildMapViewParams(40.7128, -74.006);

            expect(params.latitude).toBe(40.7128);
            expect(params.longitude).toBe(-74.006);
        });

        it('should default shouldShowPreview to false', () => {
            const params = buildMapViewParams(40.7128, -74.006);
            expect(params.shouldShowPreview).toBe(false);
        });

        it('should allow enabling preview', () => {
            const params = buildMapViewParams(40.7128, -74.006, true);
            expect(params.shouldShowPreview).toBe(true);
        });
    });
});

describe('Get Directions Integration', () => {
    interface IDirectionsParams {
        latitude: number;
        longitude: number;
        title?: string;
    }

    const buildDirectionsParams = (area: { latitude: number; longitude: number; notificationMsg?: string }): IDirectionsParams => {
        return {
            latitude: area.latitude,
            longitude: area.longitude,
            title: area.notificationMsg,
        };
    };

    describe('buildDirectionsParams', () => {
        it('should build params with coordinates and title', () => {
            const area = {
                latitude: 40.7128,
                longitude: -74.006,
                notificationMsg: 'Central Park',
            };

            const params = buildDirectionsParams(area);

            expect(params.latitude).toBe(40.7128);
            expect(params.longitude).toBe(-74.006);
            expect(params.title).toBe('Central Park');
        });

        it('should handle missing notificationMsg', () => {
            const area = {
                latitude: 40.7128,
                longitude: -74.006,
            };

            const params = buildDirectionsParams(area);

            expect(params.title).toBeUndefined();
        });
    });
});

describe('Location Service Activation', () => {
    interface IActivationResponse {
        status?: string;
        alreadyEnabled?: boolean;
    }

    const processLocationActivationResponse = (
        response: IActivationResponse,
        platform: 'ios' | 'android'
    ): { shouldProceed: boolean; wasAlreadyEnabled: boolean } => {
        if (response.status || platform === 'ios') {
            return {
                shouldProceed: true,
                wasAlreadyEnabled: response.alreadyEnabled ?? false,
            };
        }

        return {
            shouldProceed: false,
            wasAlreadyEnabled: false,
        };
    };

    describe('processLocationActivationResponse', () => {
        it('should proceed when status is set', () => {
            const response: IActivationResponse = { status: 'enabled' };
            const result = processLocationActivationResponse(response, 'android');

            expect(result.shouldProceed).toBe(true);
        });

        it('should always proceed on iOS', () => {
            const response: IActivationResponse = {};
            const result = processLocationActivationResponse(response, 'ios');

            expect(result.shouldProceed).toBe(true);
        });

        it('should not proceed on Android without status', () => {
            const response: IActivationResponse = {};
            const result = processLocationActivationResponse(response, 'android');

            expect(result.shouldProceed).toBe(false);
        });

        it('should track if GPS was already enabled', () => {
            const response: IActivationResponse = { status: 'enabled', alreadyEnabled: true };
            const result = processLocationActivationResponse(response, 'android');

            expect(result.wasAlreadyEnabled).toBe(true);
        });
    });
});

describe('Nearby Spaces Location Search', () => {
    interface ISearchParams {
        latitude: number;
        longitude: number;
        radius: number;
        limit?: number;
    }

    const buildNearbySpacesSearchParams = (
        userLocation: { latitude: number; longitude: number },
        radius = 500,
        limit = 10
    ): ISearchParams => {
        return {
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
            radius,
            limit,
        };
    };

    describe('buildNearbySpacesSearchParams', () => {
        it('should build params with user location', () => {
            const userLocation = { latitude: 40.7128, longitude: -74.006 };
            const params = buildNearbySpacesSearchParams(userLocation);

            expect(params.latitude).toBe(40.7128);
            expect(params.longitude).toBe(-74.006);
        });

        it('should use default radius of 500', () => {
            const userLocation = { latitude: 40.7128, longitude: -74.006 };
            const params = buildNearbySpacesSearchParams(userLocation);

            expect(params.radius).toBe(500);
        });

        it('should use default limit of 10', () => {
            const userLocation = { latitude: 40.7128, longitude: -74.006 };
            const params = buildNearbySpacesSearchParams(userLocation);

            expect(params.limit).toBe(10);
        });

        it('should allow custom radius', () => {
            const userLocation = { latitude: 40.7128, longitude: -74.006 };
            const params = buildNearbySpacesSearchParams(userLocation, 1000);

            expect(params.radius).toBe(1000);
        });

        it('should allow custom limit', () => {
            const userLocation = { latitude: 40.7128, longitude: -74.006 };
            const params = buildNearbySpacesSearchParams(userLocation, 500, 25);

            expect(params.limit).toBe(25);
        });
    });
});

describe('Location State Update Handling', () => {
    interface ILocationAction {
        type: string;
        payload: Record<string, any>;
    }

    const createLocationAction = (
        actionType: 'updateGpsStatus' | 'updateLocationDisclosure' | 'updateLocationPermissions',
        value: any
    ): ILocationAction => {
        const actionTypeMap = {
            updateGpsStatus: 'location/UPDATE_GPS_STATUS',
            updateLocationDisclosure: 'location/UPDATE_LOCATION_DISCLOSURE',
            updateLocationPermissions: 'location/UPDATE_LOCATION_PERMISSIONS',
        };

        return {
            type: actionTypeMap[actionType],
            payload: { value },
        };
    };

    describe('createLocationAction', () => {
        it('should create GPS status action', () => {
            const action = createLocationAction('updateGpsStatus', 'enabled');

            expect(action.type).toBe('location/UPDATE_GPS_STATUS');
            expect(action.payload.value).toBe('enabled');
        });

        it('should create location disclosure action', () => {
            const action = createLocationAction('updateLocationDisclosure', true);

            expect(action.type).toBe('location/UPDATE_LOCATION_DISCLOSURE');
            expect(action.payload.value).toBe(true);
        });

        it('should create location permissions action', () => {
            const action = createLocationAction('updateLocationPermissions', { location: 'granted' });

            expect(action.type).toBe('location/UPDATE_LOCATION_PERMISSIONS');
            expect(action.payload.value).toEqual({ location: 'granted' });
        });
    });
});
