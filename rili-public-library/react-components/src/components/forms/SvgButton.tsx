import * as React from 'react';
import BaseButton, { IBaseButtonProps } from './base/BaseButton';
import ButtonPrimary, { overrideProps as primOverrideProps } from './ButtonPrimary';
import ButtonSecondary, { overrideProps as secOverrideProps } from './ButtonSecondary';
import InlineSvg, { IInlineSvgProps } from '../InlineSvg';

const overrideProps = {
    className: 'primary text-white py-2 px-4 ml-2',
};

interface ISvgButtonProps extends IBaseButtonProps {
    className: string;
    iconClassName?: string;
    name: string;
    buttonType?: string;
}

class SvgButton extends React.Component<ISvgButtonProps & IInlineSvgProps> {
    static defaultProps = { ...BaseButton.defaultProps, ...overrideProps };

    render() {
        const {
            buttonType,
            className,
            iconClassName,
            name,
        } = this.props;
        const buttonProps = { ...this.props };
        delete buttonProps.buttonType;
        delete buttonProps.className;
        delete buttonProps.name;

        if (buttonType && buttonType === 'primary') {
            return (
                <ButtonPrimary { ...buttonProps } className={`${primOverrideProps.className} icon-button ${className || ''}`}>
                    <InlineSvg name={name} className={iconClassName || ''} />
                </ButtonPrimary>
            );
        }

        return (
            <ButtonSecondary { ...buttonProps } className={`${secOverrideProps.className} icon-button ${className || ''}`}>
                <InlineSvg name={name} className={iconClassName || ''} />
            </ButtonSecondary>
        );
    }
}

export default SvgButton;
