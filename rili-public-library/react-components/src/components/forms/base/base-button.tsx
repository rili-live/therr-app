import * as React from 'react';
import * as PropTypes from 'prop-types';

interface IBaseButtonProps {
    id?: string;
    children?: any;
    className?: string;
    disabled?: boolean;
    onClick: any;
    text?: string;
}

class BaseButton extends React.Component<IBaseButtonProps> {
    static propTypes: any = {
        id: PropTypes.string,
        onClick: PropTypes.func.isRequired,
        children: PropTypes.string.isRequired,
        className: PropTypes.string,
        disabled: PropTypes.bool,
    };

    static defaultProps = {
        disabled: false,
    };

    constructor(props: IBaseButtonProps) {
        super(props);

    }

    render() {
        const { children, className, disabled, id, onClick, text } = this.props;

        return (
            <button id={id} className={className} onClick={onClick} type="button" disabled={disabled}>
                {text ? text : children}
            </button>
        );
    }
}

export default BaseButton;
