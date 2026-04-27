import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import 'react-native-gesture-handler';
import BaseInput from './';

/**
 * @deprecated Prefer `<BaseInput variant="round" .../>`. The new variant prop
 * applies the same containerRound / inputContainerRound / hidden-underline /
 * roundness=15 overrides this wrapper does today, just without the extra
 * subclass. This file is kept so existing imports keep working — migrate
 * incrementally.
 */
export class RoundInput extends BaseInput {
    constructor(props) {
        super(props);
    }
    render() {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { themeForms, value, ref: _ref, ...restProps } = this.props as any;

        return (
            <BaseInput
                containerStyle={themeForms.styles.containerRound}
                style={ !value?.length ? themeForms.styles.placeholderText : themeForms.styles.inputText }
                placeholderTextColor={themeForms.styles.placeholderText.color}
                inputContainerStyle={themeForms.styles.inputContainerRound}
                underlineStyle={localStyles.hidden}
                roundness={15}
                value={value}
                {...restProps}
                themeForms={themeForms}
                inputStyle={[(Platform.OS !== 'ios' ? themeForms.styles.input : themeForms.styles.inputAlt), this.props.inputStyle]}
            />
        );
    }
}

const localStyles = StyleSheet.create({
    hidden: {
        display: 'none',
    },
});

export default RoundInput;
