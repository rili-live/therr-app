import * as React from 'react';

// ICONS
const iconMap: { [index: string]: string } = {
    account: require('../svg-icons/account.svg').toString(), // eslint-disable-line global-require
    close: require('../svg-icons/close.svg').toString(), // eslint-disable-line global-require
    home: require('../svg-icons/home.svg').toString(), // eslint-disable-line global-require
    location: require('../svg-icons/location.svg').toString(), // eslint-disable-line global-require
    messages: require('../svg-icons/messages.svg').toString(), // eslint-disable-line global-require
    'notifications-active': require('../svg-icons/notifications-active.svg').toString(), // eslint-disable-line global-require
    notifications: require('../svg-icons/notifications.svg').toString(), // eslint-disable-line global-require
    people: require('../svg-icons/people.svg').toString(), // eslint-disable-line global-require
    settings: require('../svg-icons/settings.svg').toString(), // eslint-disable-line global-require
};

export interface IInlineSvgProps {
    className: string;
    name: string;
}

const InlineSvg = (props: IInlineSvgProps) => {
    const { className, name } = props;

    const html = iconMap[name];

    return (<span className={(`inline-svg ${className}`).trim()} dangerouslySetInnerHTML={{ __html: html }} />);
};

export default InlineSvg;
