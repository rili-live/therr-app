/**
 * @jest-environment jsdom
 */
import 'react-native';
import AsyncStorageMock from '@react-native-async-storage/async-storage/jest/async-storage-mock';
// import React from 'react';
import mock from 'react-native-permissions/mock';
// import App from '../main/App';

// Note: test renderer must be required after react-native.
// import renderer from 'react-test-renderer';

jest.mock('react-native-country-picker-modal');
jest.mock('react-native-phone-input');
jest.mock('react-native-autolink');
jest.mock('react-native-permissions', () => mock);
jest.mock('rn-fetch-blob', () => {
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

beforeEach(() => {
    jest.useFakeTimers();
});

afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
});

describe('App', () => {
    it.skip('renders correctly', async () => {
        AsyncStorageMock.getItem = jest.fn((key, callback) => {
            // do something here to retrieve data
            callback(JSON.stringify({}));
        });
        // renderer.create(<App />);
    });
});
