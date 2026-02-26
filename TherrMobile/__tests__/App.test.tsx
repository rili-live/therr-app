/**
 * @jest-environment jsdom
 */
import 'react-native';
import AsyncStorageMock from '@react-native-async-storage/async-storage/jest/async-storage-mock';
import React from 'react';
import mock from 'react-native-permissions/mock';

// Note: import explicitly to use the types shipped with jest.
import {it} from '@jest/globals';

// Note: test renderer must be required after react-native.
import renderer, { act } from 'react-test-renderer';

// Mock Firebase app (must be before other firebase mocks)
jest.mock('@react-native-firebase/app', () => ({
    __esModule: true,
    default: () => ({
        onNotification: jest.fn(),
        onNotificationDisplayed: jest.fn(),
    }),
    firebase: {
        app: jest.fn(),
    },
}));

// Mock Firebase analytics
jest.mock('@react-native-firebase/analytics', () => () => ({
    setAnalyticsCollectionEnabled: jest.fn(),
    logEvent: jest.fn(),
    setUserId: jest.fn(),
    setUserProperties: jest.fn(),
}));

// Mock LogRocket
jest.mock('@logrocket/react-native', () => ({
    init: jest.fn(),
    identify: jest.fn(),
}));

// Mock react-native-maps
jest.mock('react-native-maps', () => ({
    default: 'MapView',
    Marker: 'Marker',
    Polyline: 'Polyline',
    Circle: 'Circle',
}));

// Mock react-native-toast-message
jest.mock('react-native-toast-message', () => {
    const MockToast = () => null;
    MockToast.show = jest.fn();
    MockToast.hide = jest.fn();
    return {
        __esModule: true,
        default: MockToast,
        BaseToast: () => null,
        ErrorToast: () => null,
        InfoToast: () => null,
    };
});

// Mock react-native-actions-sheet
jest.mock('react-native-actions-sheet', () => ({
    SheetProvider: ({ children }: { children: React.ReactNode }) => children,
    SheetManager: {
        show: jest.fn(),
        hide: jest.fn(),
    },
}));

// Mock react-native-spotlight-tour
jest.mock('react-native-spotlight-tour', () => ({
    SpotlightTourProvider: ({ children }: { children: (args: { start: () => void; stop: () => void }) => React.ReactNode }) =>
        children({ start: jest.fn(), stop: jest.fn() }),
}));

// Mock react-native-gesture-handler
jest.mock('react-native-gesture-handler', () => ({
    GestureHandlerRootView: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock the Layout component to avoid having to mock all the native modules it imports
jest.mock('../main/components/Layout', () => {
    const ReactMock = require('react');
    return function MockLayout() {
        return ReactMock.createElement('View', { testID: 'mock-layout' }, 'Mock Layout');
    };
});

// Mock getStore to return a mock Redux store
jest.mock('../main/getStore', () => {
    const { configureStore } = require('@reduxjs/toolkit');
    return jest.fn(() => Promise.resolve(
        configureStore({
            reducer: {
                user: () => ({
                    settings: { locale: 'en-us' },
                }),
            },
        })
    ));
});

// Mock getTourSteps
jest.mock('../main/getTourSteps', () => jest.fn(() => []));

// Mock interceptors
jest.mock('../main/interceptors', () => jest.fn());

// Mock ActionSheet import in App
jest.mock('../main/components/ActionSheet', () => ({}));

jest.mock('react-native-country-picker-modal');
jest.mock('react-native-phone-input');
jest.mock('react-native-autolink');
jest.mock('react-native-permissions', () => mock);
jest.mock('react-native-blob-util', () => {
    return {
        DocumentDir: () => {},
        fetch: () => {},
        base64: () => {},
        android: () => {},
        ios: () => {},
        config: () => {},
        session: () => {},
        fs: {
            dirs: {
                MainBundleDir: () => {},
                CacheDir: () => {},
                DocumentDir: () => {},
            },
        },
        wrap: () => {},
        polyfill: () => {},
        JSONStream: () => {},
    };
});

// Import App after mocks are set up (jest.mock calls are hoisted)
import App from '../main/App';

beforeEach(() => {
    jest.useFakeTimers();
});

afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
});

describe('App', () => {
    it('renders correctly', async () => {
        AsyncStorageMock.getItem = jest.fn((_key, callback) => {
            // do something here to retrieve data
            if (callback) {
                callback(null, JSON.stringify({}));
            }
            return Promise.resolve(JSON.stringify({}));
        });

        let component: renderer.ReactTestRenderer;

        await act(async () => {
            // @ts-expect-error - React type mismatch between test-renderer and App component
            component = renderer.create(<App />);
        });

        // Run timers to allow the store to be loaded
        await act(async () => {
            jest.runAllTimers();
        });

        // After store is loaded, the app should render
        expect(component!.toJSON()).toBeDefined();
    });
});
