import 'react-native';
import React from 'react';

// Note: import explicitly to use the types shipped with jest.
import { it, describe, expect, beforeEach } from '@jest/globals';
import renderer, { act } from 'react-test-renderer';

/**
 * The contacts primer is the app's Google Play "Prominent Disclosure" for uploading the
 * user's address book to api.therr.com. Version 20 was rejected because it rendered a
 * single line — "Your address book stays on your device" — that was both incomplete and
 * untrue of what `utilities/contacts.ts` actually does.
 *
 * These tests pin the shape Play policy requires: the data collected, the fact that it
 * leaves the device and where it goes, how it is used, an opt-out, a privacy policy
 * link, and an affirmative agree action. Permissions whose data never leaves the device
 * keep the lighter one-line primer, so that stays pinned too.
 */

/**
 * Paper's Dialog renders through a Portal host that these tests have no provider for, so
 * the real components throw on mount. They have to be mocked at their deep paths rather
 * than as `react-native-paper`: `babel.config.js` applies the `react-native-paper/babel`
 * plugin unconditionally, which rewrites every named import into
 * `react-native-paper/lib/module/components/...` before Jest ever sees the module name.
 * A `jest.mock('react-native-paper')` here would silently never apply.
 */
const mockPaperComponent = (withDialogStatics = false) => {
    const React2 = require('react');
    const { Text, View } = require('react-native');

    const Component: any = ({ children }: any) => React2.createElement(View, null, children);

    if (withDialogStatics) {
        Component.Title = ({ children }: any) => React2.createElement(Text, null, children);
        Component.Content = ({ children }: any) => React2.createElement(View, null, children);
        Component.ScrollArea = ({ children }: any) => React2.createElement(View, null, children);
        Component.Actions = ({ children }: any) => React2.createElement(View, null, children);
    }

    return { __esModule: true, default: Component };
};

jest.mock('react-native-paper/lib/module/components/Portal/Portal', () => mockPaperComponent());
jest.mock('react-native-paper/lib/module/components/Dialog/Dialog', () => mockPaperComponent(true));
jest.mock('react-native-paper/lib/module/components/Button/Button', () => mockPaperComponent());

const PermissionPrimerModal = require('../../main/components/Modals/PermissionPrimerModal').default;

const themeDisclosure = { styles: {} };

/** Renders the modal and returns every translation key it asked for. */
const renderKeys = (permissionType: string): string[] => {
    const requested: string[] = [];
    const translate = (key: string) => {
        requested.push(key);
        return key;
    };

    // React 19 defers the commit to the scheduler, so without `act` the render lands
    // after the assertion (and after teardown) and `requested` reads back empty.
    act(() => {
        renderer.create(
            <PermissionPrimerModal
                permissionType={permissionType}
                isVisible
                onAllow={() => {}}
                onNotNow={() => {}}
                translate={translate}
                themeDisclosure={themeDisclosure}
            />,
        );
    });

    return requested;
};

describe('PermissionPrimerModal', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('contacts — prominent disclosure', () => {
        it('renders every part of the disclosure, not just a headline', () => {
            const keys = renderKeys('contacts');

            expect(keys).toEqual(expect.arrayContaining([
                'permissions.primer.contacts.title',
                // What is collected and that it is sent to our servers.
                'permissions.primer.contacts.summary',
                // How it is used and what is retained.
                'permissions.primer.contacts.detail',
                // That the feature is optional and how to turn it off.
                'permissions.primer.contacts.optOut',
            ]));
        });

        it('links out to the privacy policy', () => {
            expect(renderKeys('contacts')).toContain('permissions.primer.shared.privacyPolicy');
        });

        it('asks for affirmative agreement rather than a bare permission allow', () => {
            const keys = renderKeys('contacts');

            expect(keys).toContain('permissions.primer.shared.agree');
            expect(keys).toContain('permissions.primer.shared.decline');
        });

        it('never falls back to the retired one-line body that claimed contacts stay on device', () => {
            expect(renderKeys('contacts')).not.toContain('permissions.primer.contacts.body');
        });
    });

    describe('on-device permissions — lightweight primer', () => {
        it.each(['camera', 'notifications'])('%s keeps the one-line body', (permissionType) => {
            const keys = renderKeys(permissionType);

            expect(keys).toEqual([
                `permissions.primer.${permissionType}.title`,
                `permissions.primer.${permissionType}.body`,
                'permissions.primer.shared.notNow',
                'permissions.primer.shared.allow',
            ]);
        });
    });
});
