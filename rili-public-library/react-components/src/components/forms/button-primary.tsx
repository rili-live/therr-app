import * as React from 'react';
import * as PropTypes from 'prop-types';
import BaseButton from './base/base-button';

const overrideProps = {
    className: 'primary text-white py-2 px-4 ml-2',
};

class ButtonPrimary extends BaseButton {
    static defaultProps = { ...BaseButton.defaultProps, ...overrideProps};
}

export default ButtonPrimary;
