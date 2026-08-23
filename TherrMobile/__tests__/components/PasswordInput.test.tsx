import 'react-native';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { describe, it, expect } from '@jest/globals';
import PasswordInput from '../../main/components/Input/PasswordInput';

const mockStyles = {
    placeholderText: {
        color: 'white',
    },
};

const translate = (key: string) => key;

const renderPasswordInput = (props: any = {}) => {
    let component!: renderer.ReactTestRenderer;

    act(() => {
        component = renderer.create(
            <PasswordInput
                translate={translate}
                value=""
                onChangeText={jest.fn()}
                themeForms={{ styles: mockStyles, colors: {} as any }}
                testID="test-password"
                {...props}
            />
        );
    });

    return component;
};

const findToggle = (component: renderer.ReactTestRenderer) =>
    component.root.findByProps({ testID: 'test-password-visibility-toggle' });

// A testID is carried by every wrapper in the chain (PasswordInput -> BaseInput -> Paper's
// TextInput -> the host input), so narrow to the host element — it is the only one whose
// props are what React Native actually receives.
const findField = (component: renderer.ReactTestRenderer) => {
    const matches = component.root.findAllByProps({ testID: 'test-password' });
    const host = matches.find((node) => typeof node.type === 'string');

    if (!host) {
        throw new Error('No host input rendered for testID "test-password"');
    }

    return host;
};

describe('PasswordInput', () => {
    it('masks the password until the toggle is pressed', () => {
        const component = renderPasswordInput();

        expect(findField(component).props.secureTextEntry).toEqual(true);

        act(() => {
            findToggle(component).props.onPress();
        });

        expect(findField(component).props.secureTextEntry).toEqual(false);
    });

    it('re-masks on a second press', () => {
        const component = renderPasswordInput();
        const toggle = () => act(() => {
            findToggle(component).props.onPress();
        });

        toggle();
        toggle();

        expect(findField(component).props.secureTextEntry).toEqual(true);
    });

    it('swaps the eye glyph and its accessible name with the state', () => {
        // The label has to describe what the button *does*, not what it shows, or a screen
        // reader announces the opposite of the action.
        const component = renderPasswordInput();

        expect(findToggle(component).props.accessibilityLabel)
            .toEqual('forms.passwordInput.labels.showPassword');

        act(() => {
            findToggle(component).props.onPress();
        });

        expect(findToggle(component).props.accessibilityLabel)
            .toEqual('forms.passwordInput.labels.hidePassword');
    });

    it('starts masked even when re-created with a value already present', () => {
        // A remembered profile or a returning render must never mount revealed.
        const component = renderPasswordInput({ value: 'hunter2' });

        expect(findField(component).props.secureTextEntry).toEqual(true);
    });

    it('leaves the caller in control of the value', () => {
        // iOS drops the field's buffered text when secureTextEntry flips; re-applying the
        // controlled value on the next render is what puts the password back.
        const component = renderPasswordInput({ value: 'hunter2' });

        act(() => {
            findToggle(component).props.onPress();
        });

        expect(findField(component).props.value).toEqual('hunter2');
    });
});
