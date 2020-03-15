import * as React from 'react';
import BaseButton, { IBaseButtonProps } from './base/BaseButton';
import ButtonPrimary from './ButtonPrimary';
import ButtonSecondary from './ButtonSecondary';
import InlineSvg, { IInlineSvgProps } from '../InlineSvg';

const overrideProps = {
    className: 'primary text-white py-2 px-4 ml-2',
};

interface ISvgButtonProps extends IBaseButtonProps {
    className: string;
    name: string;
    buttonType?: string;
}

class SvgButton extends React.Component<ISvgButtonProps & IInlineSvgProps> {
    static defaultProps = { ...BaseButton.defaultProps, ...overrideProps };

    render() {
        const { buttonType, className, name } = this.props;
        const buttonProps = { ...this.props };
        delete buttonProps.buttonType;
        delete buttonProps.className;
        delete buttonProps.name;

        if (buttonType && buttonType === 'primary') {
            return (
                <ButtonPrimary { ...buttonProps }>
                    <InlineSvg name={name} className={className} />
                </ButtonPrimary>
            );
        }

        return (
            <ButtonSecondary { ...buttonProps }>
                <InlineSvg name={name} className={className} />
            </ButtonSecondary>
        );
    }
}

export default SvgButton;
