import React from 'react';
import { TextInput as PaperTextInput } from 'react-native-paper';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import 'react-native-gesture-handler';
import BaseInput, { IBaseInputProps } from './index';

export interface IPasswordInputProps extends Omit<IBaseInputProps, 'secureTextEntry' | 'right'> {
    /** Both toggle states need an accessible name, so the field has to be able to translate. */
    translate: (key: string, params?: any) => string;
    /** Defaults to the colour Paper gives the adornment for the current focus state. */
    iconColor?: string;
}

interface IPasswordInputState {
    isPasswordVisible: boolean;
}

/**
 * A password field with a show/hide toggle in the trailing icon slot.
 *
 * The eye replaces the decorative key/lock glyph these fields used to pass via `rightIcon`.
 * Two icons don't fit that slot at a comfortable tap size, only one of them does anything —
 * and, as the note on `right` in `./index.tsx` explains, `rightIcon` renders nothing at all
 * under Paper. The toggle therefore goes through `TextInput.Icon`, which is one of the two
 * element types Paper will actually mount as an adornment.
 *
 * Two things callers must leave alone:
 *
 * - `secureTextEntry` is owned here, which is why it's excluded from the props type.
 * - `value` must stay controlled by the caller. On iOS, flipping `secureTextEntry` while the
 *   field has focus makes the platform drop its buffered text; re-applying the controlled
 *   `value` on the next render is what puts the password back.
 *
 * Visibility lives in component state, so it resets to hidden on unmount — a revealed password
 * never survives leaving the screen.
 */
export class PasswordInput extends React.Component<IPasswordInputProps, IPasswordInputState> {
    constructor(props: IPasswordInputProps) {
        super(props);

        this.state = {
            isPasswordVisible: false,
        };
    }

    toggleVisibility = () => {
        this.setState((prevState) => ({
            isPasswordVisible: !prevState.isPasswordVisible,
        }));
    };

    render() {
        const {
            translate,
            iconColor,
            testID,
            ...inputProps
        } = this.props;
        const { isPasswordVisible } = this.state;

        return (
            <BaseInput
                autoCapitalize="none"
                autoCorrect={false}
                {...inputProps}
                testID={testID}
                secureTextEntry={!isPasswordVisible}
                right={
                    <PaperTextInput.Icon
                        // The render-function form of `icon`, so this never depends on Paper
                        // resolving an icon name against a font we don't register with it.
                        // Paper *calls* this rather than mounting it as a component type, so
                        // the usual remount-on-every-render hazard doesn't apply.
                        // eslint-disable-next-line react/no-unstable-nested-components
                        icon={({ size, color }) => (
                            <MaterialIcon
                                name={isPasswordVisible ? 'visibility' : 'visibility-off'}
                                size={size}
                                color={iconColor ?? color}
                            />
                        )}
                        onPress={this.toggleVisibility}
                        // Tapping the eye is about reading the field, not editing it. Forcing
                        // focus here would raise the keyboard over the text the user just
                        // asked to see.
                        forceTextInputFocus={false}
                        accessibilityLabel={translate(isPasswordVisible
                            ? 'forms.passwordInput.labels.hidePassword'
                            : 'forms.passwordInput.labels.showPassword')}
                        testID={testID ? `${testID}-visibility-toggle` : 'password-visibility-toggle'}
                    />
                }
            />
        );
    }
}

export default PasswordInput;
