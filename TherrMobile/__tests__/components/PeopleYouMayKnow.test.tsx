import 'react-native';
import React from 'react';
import { Provider } from 'react-redux';

// Note: test renderer must be required after react-native.
import renderer, { act } from 'react-test-renderer';

// Note: import explicitly to use the types shipped with jest.
import { it, describe, beforeEach, afterEach, expect } from '@jest/globals';

// `main/constants` (reached through the profile-completion utility) pulls in
// notifee, which reaches for its native module at import time.
jest.mock('@notifee/react-native', () => ({
    __esModule: true,
    default: { createChannel: jest.fn() },
    AndroidImportance: { HIGH: 4, DEFAULT: 3, LOW: 2 },
    AndroidVisibility: { PUBLIC: 1 },
}));

jest.mock('lottie-react-native', () => 'LottieView');

jest.mock('therr-react/services', () => ({
    UsersService: {
        getUserInterests: jest.fn().mockResolvedValue({ data: [] }),
    },
}));

const mockSyncMobileContacts = jest.fn();
jest.mock('../../main/utilities/contacts', () => ({
    synceMobileContacts: (...args: any[]) => mockSyncMobileContacts(...args),
}));

import PeopleYouMayKnow from '../../main/routes/Connect/components/PeopleYouMayKnow';
import { getProfileCompletionFlags, markContactsSynced } from '../../main/utilities/profileCompletion';
import { buildStyles } from '../../main/styles';
import { buildStyles as buildButtonsStyles } from '../../main/styles/buttons';

const AsyncStorage = require('@react-native-async-storage/async-storage').default;

const mockStore = {
    getState: () => ({ user: { settings: { mobileThemeName: 'light' } } }),
    subscribe: () => () => {},
    dispatch: () => {},
};

const translate = (key: string) => key;
const theme = buildStyles('light');
const themeButtons = buildButtonsStyles('light');

const buildProps = (overrides: any = {}) => ({
    mightKnowUsers: [],
    getConnectionOrUserDetails: (u: any) => u,
    getConnectionSubtitle: () => '',
    goToViewUser: jest.fn(),
    onSendConnectRequest: jest.fn(),
    theme,
    themeButtons,
    translate,
    user: { details: { id: 'user-123' } },
    ...overrides,
});

const render = async (props: any) => {
    let component: renderer.ReactTestRenderer;
    await act(async () => {
        component = renderer.create(
            <Provider store={mockStore as any}>
                <PeopleYouMayKnow {...props} />
            </Provider>
        );
        await Promise.resolve();
    });
    return component!;
};

const findSyncButton = (component: renderer.ReactTestRenderer) => component.root.findAll(
    (node) => typeof node.props?.title === 'string' && node.props.title.startsWith('pages.contacts.buttons.sync')
);

beforeEach(async () => {
    await AsyncStorage.clear();
    mockSyncMobileContacts.mockResolvedValue({ contacts: [], matchedUsers: [] });
});

afterEach(() => {
    jest.clearAllMocks();
});

describe('PeopleYouMayKnow contact-sync prompt', () => {
    it('offers the full sync prompt to a user who has never synced', async () => {
        const component = await render(buildProps());

        expect(findSyncButton(component)).toHaveLength(1);
        expect(JSON.stringify(component.toJSON())).toContain('pages.contacts.labels.noContactsFound');
    });

    it('collapses to a re-sync link once contacts have been synced before', async () => {
        await markContactsSynced('user-123');

        const component = await render(buildProps());
        const tree = JSON.stringify(component.toJSON());

        expect(findSyncButton(component)).toHaveLength(0);
        expect(tree).toContain('pages.contacts.buttons.resyncContacts');
        // The "no users found" explainer is part of the full prompt, not the collapsed one.
        expect(tree).not.toContain('pages.contacts.labels.noContactsFound');
    });

    it('re-opens the full prompt when the user taps the re-sync link', async () => {
        await markContactsSynced('user-123');

        const component = await render(buildProps());
        const [resyncLink] = component.root.findAll(
            (node) => node.props?.accessibilityLabel === 'pages.contacts.buttons.resyncContacts'
                && typeof node.props?.onPress === 'function'
        );

        await act(async () => { resyncLink.props.onPress(); });

        expect(findSyncButton(component)).toHaveLength(1);
    });

    it('records the sync so the prompt stays collapsed on the next visit', async () => {
        const component = await render(buildProps());
        const [syncButton] = findSyncButton(component);

        await act(async () => {
            syncButton.props.onPress();
            await Promise.resolve();
        });

        await expect(getProfileCompletionFlags('user-123'))
            .resolves.toEqual(expect.objectContaining({ hasSyncedContacts: true }));
    });

    it('keeps the prompt visible after a failed sync so the error is readable', async () => {
        mockSyncMobileContacts.mockRejectedValue(new Error('permissions-denied'));

        const component = await render(buildProps());
        const [syncButton] = findSyncButton(component);

        await act(async () => {
            syncButton.props.onPress();
            await Promise.resolve();
        });

        const [afterSync] = findSyncButton(component);
        expect(afterSync.props.title).toBe('pages.contacts.buttons.syncFailed');
        await expect(getProfileCompletionFlags('user-123'))
            .resolves.toEqual(expect.objectContaining({ hasSyncedContacts: false }));
    });

    it('does not prompt at all when there are already people to show', async () => {
        const component = await render(buildProps({
            mightKnowUsers: [{ id: 'other-user', userName: 'someone' }],
        }));
        const tree = JSON.stringify(component.toJSON());

        expect(findSyncButton(component)).toHaveLength(0);
        expect(tree).not.toContain('pages.contacts.buttons.resyncContacts');
    });
});
