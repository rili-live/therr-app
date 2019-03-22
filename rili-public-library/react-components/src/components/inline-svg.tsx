import * as React from 'react';

// ICONS
const iconMap: { [index: string]: string } = {
    home: require('../svg-icons/home.svg').toString()
};

export interface IInlineSvgProps {
    className: string;
    name: string;
}

const InlineSvg = (props: IInlineSvgProps) => {
    const { className, name } = props;

    const html = iconMap[name];

    return (<span className={(`inline-svg ${className}`).trim()} dangerouslySetInnerHTML={{__html: html}} />);
};

export default InlineSvg;
