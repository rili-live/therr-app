import * as React from 'react';
import * as PropTypes from 'prop-types';

const ButtonPrimary = ({ children, className, disabled, onClick }: any) => (
    <button className={className} onClick={onClick} type="button" disabled={disabled} >
        {children}
    </button>
);

ButtonPrimary.propTypes = {
    onClick: PropTypes.func.isRequired,
    children: PropTypes.string.isRequired,
    className: PropTypes.string,
    disabled: PropTypes.bool,
};

ButtonPrimary.defaultProps = {
    className: 'primary text-white py-2 px-4 ml-2',
    disabled: false,
};

export default ButtonPrimary;
