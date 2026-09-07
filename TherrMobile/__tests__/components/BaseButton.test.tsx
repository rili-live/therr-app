import 'react-native';
import React from 'react';
import { View } from 'react-native';

// Note: test renderer must be required after react-native.
import renderer, { act } from 'react-test-renderer';

// Note: import explicitly to use the types shipped with jest.
import { it, describe, expect } from '@jest/globals';

import { Button } from '../../main/components/BaseButton';

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux'),
    useSelector: (selector: (state: any) => any) => selector({ user: { settings: {} } }),
}));

const ICON_TEST_ID = 'base-button-icon';
const TITLE = 'Profile';

const render = (props: any) => {
    let component: renderer.ReactTestRenderer;
    act(() => {
        component = renderer.create(
            <Button
                title={TITLE}
                icon={<View testID={ICON_TEST_ID} />}
                {...props}
            />,
        );
    });

    return component!.toJSON() as any;
};

// Walks the rendered host tree and returns the chain of ancestors ending at the
// icon node, outermost first.
const pathToIcon = (node: any, ancestors: any[] = []): any[] | null => {
    if (!node || typeof node !== 'object') {
        return null;
    }
    if (node.props?.testID === ICON_TEST_ID) {
        return [...ancestors, node];
    }
    for (const child of node.children || []) {
        const found = pathToIcon(child, [...ancestors, node]);
        if (found) {
            return found;
        }
    }
    return null;
};

// Flattens the rendered host tree into the order its leaves appear, marking the
// icon and the title so their relative position can be asserted.
const leafOrder = (node: any, acc: string[] = []): string[] => {
    if (typeof node === 'string') {
        if (node === TITLE) {
            acc.push('title');
        }
        return acc;
    }
    if (!node || typeof node !== 'object') {
        return acc;
    }
    if (node.props?.testID === ICON_TEST_ID) {
        acc.push('icon');
        return acc;
    }
    (node.children || []).forEach((child: any) => leafOrder(child, acc));
    return acc;
};

describe('BaseButton', () => {
    it('renders the icon before the title by default', () => {
        expect(leafOrder(render({}))).toEqual(['icon', 'title']);
    });

    // Regression: `iconContainerStyle` used to be declared and then silently dropped, so
    // the HABITS nav bar's avatar sat flush against its "Profile" label while the
    // icon-font tabs kept the side bearing baked into their glyphs.
    it('wraps the icon in a view carrying iconContainerStyle when one is supplied', () => {
        const iconContainerStyle = { marginRight: 6 };
        const path = pathToIcon(render({ iconContainerStyle }));
        const wrapper = path![path!.length - 2];

        expect(wrapper.type).toBe('View');
        expect(wrapper.props.style).toBe(iconContainerStyle);
        // The wrapper holds the icon alone — the title stays outside it.
        expect(leafOrder(wrapper)).toEqual(['icon']);
    });

    it('leaves the icon unwrapped when no iconContainerStyle is supplied', () => {
        const path = pathToIcon(render({}));
        const parent = path![path!.length - 2];

        // Without the prop the icon's direct parent is the button's content row,
        // which also holds the title — i.e. no extra view was introduced.
        expect(leafOrder(parent)).toEqual(['icon', 'title']);
    });

    it('still places the icon after the title when iconRight is set', () => {
        const tree = render({ iconRight: true, iconContainerStyle: { marginLeft: 6 } });

        expect(leafOrder(tree)).toEqual(['title', 'icon']);
    });
});
