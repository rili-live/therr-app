import 'react-native';
import AsyncStorageMock from '@react-native-community/async-storage/jest/async-storage-mock';
import React from 'react';
import App from '../main/App';

// Note: test renderer must be required after react-native.
import renderer from 'react-test-renderer';

jest.mock('react-native-country-picker-modal');
jest.mock('react-native-phone-input');

beforeEach(() => {
    jest.useFakeTimers();
});

afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
});

it('renders correctly', async () => {
    AsyncStorageMock.getItem = jest.fn((key, callback) => {
        // do something here to retrieve data
        callback(JSON.stringify({}));
    });
    renderer.create(<App />);
});
