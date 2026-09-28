import 'react-native';
import React from 'react';
import { FlatList } from 'react-native';

// Note: test renderer must be required after react-native.
import renderer, { act } from 'react-test-renderer';

// Note: import explicitly to use the types shipped with jest.
import { it, describe, expect, jest, beforeEach, afterEach } from '@jest/globals';

import AreaCarousel from '../../main/routes/Areas/AreaCarousel';

// Each post renders as its id, so the order the list hands FlatList is all this suite reads.
jest.mock('../../main/components/UserContent/ThoughtDisplay', () => {
    const { Text: MockText } = require('react-native');
    return ({ thought }: any) => <MockText>{thought.id}</MockText>;
});
jest.mock('@gorhom/bottom-sheet', () => ({ BottomSheetFlatList: () => null }));

/**
 * AreaCarousel stable-order tests.
 *
 * A ranked feed re-ranks its whole cached list on every render. Without `stableOrderKey`
 * the posts already on screen reshuffle whenever a page is appended or a post is liked,
 * which is the feed "jumping" as the user scrolls. These pin the carousel's side of the fix:
 * with a key, rendered posts hold their slots until the key changes.
 */

// VirtualizedList batches cell rendering on a timer; keep it off the real clock.
beforeEach(() => {
    jest.useFakeTimers();
});

afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
});

const post = (id: string) => ({ id, createdAt: new Date().toISOString(), fromUserId: `u-${id}` });

const baseProps: any = {
    content: { media: {} },
    inspectContent: () => {},
    containerRef: () => {},
    goToViewMap: () => {},
    goToViewUser: () => {},
    handleRefresh: () => Promise.resolve(),
    isLoading: false,
    toggleAreaOptions: () => {},
    translate: (key: string) => key,
    updateEventReaction: () => {},
    updateMomentReaction: () => {},
    updateSpaceReaction: () => {},
    emptyListMessage: '',
    renderHeader: () => null,
    renderLoader: () => null,
    rootStyles: {},
    user: { details: { id: 'me' }, settings: {} },
};

const renderedIds = (tree: renderer.ReactTestRenderer) => tree.root
    .findByType(FlatList).props.data.map((p: any) => p.id);

const renderCarousel = (props: any) => {
    let tree: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(<AreaCarousel {...baseProps} {...props} />); });
    return {
        rerender: (next: any) => act(() => { tree.update(<AreaCarousel {...baseProps} {...next} />); }),
        ids: () => renderedIds(tree),
    };
};

describe('AreaCarousel stableOrderKey', () => {
    it('appends a newly paged post below the rendered ones instead of hoisting it', () => {
        const carousel = renderCarousel({ activeData: [post('a'), post('b')], stableOrderKey: 1 });
        carousel.rerender({ activeData: [post('c'), post('b'), post('a')], stableOrderKey: 1 });

        expect(carousel.ids()).toEqual(['a', 'b', 'c']);
    });

    it('accepts the fresh ranking once the key changes', () => {
        const carousel = renderCarousel({ activeData: [post('a'), post('b')], stableOrderKey: 1 });
        carousel.rerender({ activeData: [post('c'), post('b'), post('a')], stableOrderKey: 2 });

        expect(carousel.ids()).toEqual(['c', 'b', 'a']);
    });

    it('passes the ranking straight through when no key is given', () => {
        const carousel = renderCarousel({ activeData: [post('a'), post('b')] });
        carousel.rerender({ activeData: [post('b'), post('a')] });

        expect(carousel.ids()).toEqual(['b', 'a']);
    });
});
