import 'react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

// Note: test renderer must be required after react-native.
import renderer, { act } from 'react-test-renderer';

// Note: import explicitly to use the types shipped with jest.
import { it, describe, expect } from '@jest/globals';

import toastConfig, {
    TOAST_MIN_HEIGHT,
    TOAST_TEXT1_MAX_LINES,
    TOAST_TEXT2_MAX_LINES,
} from '../../main/components/toastConfig';

// Types that `showToast` and direct `Toast.show` callers name. A type missing from the
// config renders nothing at all.
const REGISTERED_TOAST_TYPES = [
    'info', 'success', 'successBig', 'warn', 'warnBig', 'notifyPublic', 'error', 'errorBig',
];

const LONG_TEXT = 'This message is long enough that it will wrap across several lines on any phone width.';

const renderToast = (type: string, props: any = {}) => {
    let component: renderer.ReactTestRenderer;
    act(() => {
        component = renderer.create(
            <>
                {toastConfig[type]({
                    type,
                    position: 'bottom',
                    isVisible: true,
                    text1: LONG_TEXT,
                    text2: LONG_TEXT,
                    show: () => {},
                    hide: () => {},
                    onPress: () => {},
                    props,
                })}
            </>,
        );
    });
    return component!;
};

const findByTestId = (component: renderer.ReactTestRenderer, testID: string) => component.root
    .findAll((node) => node.props.testID === testID && typeof node.type !== 'string')[0];

describe('toastConfig', () => {
    it('registers every toast type callers use', () => {
        REGISTERED_TOAST_TYPES.forEach((type) => {
            expect(typeof toastConfig[type]).toBe('function');
        });
    });

    // Regression: BaseToast's own style pins `height: 60`, so multi-line text overflowed the card.
    it.each(REGISTERED_TOAST_TYPES)('%s grows with its content instead of a fixed height', (type) => {
        const component = renderToast(type);
        const container = StyleSheet.flatten(findByTestId(component, 'toastTouchableContainer').props.style);

        expect(container.height).toBe('auto');
        expect(container.minHeight).toBe(TOAST_MIN_HEIGHT);
        // Fits narrow screens rather than the library's fixed 340dp.
        expect(container.width).toBe('92%');
    });

    it.each(REGISTERED_TOAST_TYPES)('%s wraps text1 and text2 instead of truncating to one line', (type) => {
        const component = renderToast(type);

        expect(findByTestId(component, 'toastText1').props.numberOfLines).toBe(TOAST_TEXT1_MAX_LINES);
        expect(findByTestId(component, 'toastText2').props.numberOfLines).toBe(TOAST_TEXT2_MAX_LINES);
    });

    it('applies a caller extraStyle on top of the auto-sizing base', () => {
        const component = renderToast('notifyPublic', { extraStyle: { minHeight: 90, marginBottom: 10 } });
        const container = StyleSheet.flatten(findByTestId(component, 'toastTouchableContainer').props.style);

        expect(container.height).toBe('auto');
        expect(container.minHeight).toBe(90);
        expect(container.marginBottom).toBe(10);
    });
});
