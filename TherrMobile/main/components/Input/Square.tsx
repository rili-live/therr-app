import React from 'react';
import 'react-native-gesture-handler';
import BaseInput from './';

/**
 * @deprecated Prefer `<BaseInput variant="square" .../>`. The new variant prop
 * applies the same inputContainerSquare override this wrapper does today,
 * just without the extra subclass. This file is kept so existing imports
 * keep working — migrate incrementally.
 */
export class SquareInput extends BaseInput {
    constructor(props) {
        super(props);
    }

    render() {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { themeForms, ref: _ref, ...restProps } = this.props as any;

        return (
            <BaseInput
                inputContainerStyle={themeForms.styles.inputContainerSquare}
                {...restProps}
                themeForms={themeForms}
            />
        );
    }
}

export default SquareInput;
