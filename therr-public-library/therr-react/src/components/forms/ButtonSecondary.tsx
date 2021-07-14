import * as React from 'react';
import * as PropTypes from 'prop-types';
import BaseButton from './base/BaseButton';

export const overrideProps = {
    className: 'secondary text-grey-darkest py-2 px-4',
};

class ButtonSecondary extends BaseButton {
    static defaultProps = { ...BaseButton.defaultProps, ...overrideProps };
}

export default ButtonSecondary;
