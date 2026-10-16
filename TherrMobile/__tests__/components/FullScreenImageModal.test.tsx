import 'react-native';
import React from 'react';
import { Modal } from 'react-native';
import FullScreenImageModal from '../../main/components/Modals/FullScreenImageModal';

// Note: test renderer must be required after react-native.
import renderer, { act } from 'react-test-renderer';

// Note: import explicitly to use the types shipped with jest.
import { it, describe, expect } from '@jest/globals';

/**
 * Tapping a profile picture opens it full size in this viewer; tapping anywhere or the
 * close button (or Android back, via onRequestClose) dismisses it.
 */

jest.mock('react-native-safe-area-context', () => ({
    useSafeAreaInsets: () => ({ top: 24, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('react-native-vector-icons/MaterialIcons', () => () => null);

const render = (imageUri: string | null, onRequestClose = jest.fn()) => {
    let tree: renderer.ReactTestRenderer;
    act(() => {
        tree = renderer.create(
            <FullScreenImageModal
                imageUri={imageUri}
                onRequestClose={onRequestClose}
                accessibilityLabel="Full-size profile picture of zack"
                closeLabel="Close image"
            />,
        );
    });
    return tree!;
};

describe('FullScreenImageModal', () => {
    it('is hidden when no image is selected', () => {
        const tree = render(null);
        expect(tree.root.findByType(Modal).props.visible).toBe(false);
    });

    it('shows the selected image at full size', () => {
        const tree = render('https://example.com/me.jpg?tr=h-1080,w-1080');
        expect(tree.root.findByType(Modal).props.visible).toBe(true);
        const image = tree.root.findAll((node) => node.props.source?.uri === 'https://example.com/me.jpg?tr=h-1080,w-1080');
        expect(image.length).toBeGreaterThan(0);
        expect(image[0].props.resizeMode).toBe('contain');
    });

    it('closes from the backdrop, the close button and Android back', () => {
        const onRequestClose = jest.fn();
        const tree = render('https://example.com/me.jpg', onRequestClose);
        const findPressable = (match: (props: any) => boolean) =>
            tree.root.find((node) => typeof node.props.onPress === 'function' && match(node.props));
        const backdrop = findPressable((props) => props.accessibilityRole === 'imagebutton');
        const closeButton = findPressable((props) => props.accessibilityLabel === 'Close image');

        act(() => { backdrop!.props.onPress(); });
        act(() => { closeButton!.props.onPress(); });
        act(() => { tree.root.findByType(Modal).props.onRequestClose(); });

        expect(onRequestClose).toHaveBeenCalledTimes(3);
    });
});
