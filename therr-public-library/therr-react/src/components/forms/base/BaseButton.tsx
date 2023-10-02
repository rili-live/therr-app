import * as React from 'react';
import * as PropTypes from 'prop-types';

export interface IBaseButtonProps {
    id?: string;
    children?: any;
    className?: string;
    disabled?: boolean;
    onClick: any;
    text?: string;
    'aria-label'?: string;
}

class BaseButton extends React.Component<IBaseButtonProps> {
    static propTypes: any = {
        id: PropTypes.string,
        onClick: PropTypes.func.isRequired,
        className: PropTypes.string,
        disabled: PropTypes.bool,
    };

    static defaultProps = {
        disabled: false,
    };

    render() {
        const {
            children, className, disabled, id, onClick, text,
        } = this.props;

        return (
            <button aria-label={this.props['aria-label']} id={id} className={className} onClick={onClick} type="button" disabled={disabled}>
                {text || children}
            </button>
        );
    }
}

export default BaseButton;
