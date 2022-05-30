/* eslint-disable @typescript-eslint/no-var-requires */
import * as React from 'react';

/* eslint-disable global-require */
// ICONS
const iconMap: { [index: string]: string } = {
    account: require('../svg-icons/account.svg').toString(),
    'add-circle': require('../svg-icons/add-circle.svg').toString(),
    close: require('../svg-icons/close.svg').toString(),
    dashboard: require('../svg-icons/dashboard.svg').toString(),
    door: require('../svg-icons/door.svg').toString(),
    bookmark: require('../svg-icons/bookmark.svg').toString(),
    'bookmark-border': require('../svg-icons/bookmark-border.svg').toString(),
    favorite: require('../svg-icons/favorite.svg').toString(),
    'favorite-border': require('../svg-icons/favorite-border.svg').toString(),
    forum: require('../svg-icons/forum.svg').toString(),
    home: require('../svg-icons/home.svg').toString(),
    location: require('../svg-icons/location.svg').toString(),
    info: require('../svg-icons/info.svg').toString(),
    messages: require('../svg-icons/messages.svg').toString(),
    'notifications-active': require('../svg-icons/notifications-active.svg').toString(),
    notifications: require('../svg-icons/notifications.svg').toString(),
    people: require('../svg-icons/people.svg').toString(),
    'people-alt': require('../svg-icons/people-alt.svg').toString(),
    therr: require('../svg-icons/therr.svg').toString(),
    'therr-text': require('../svg-icons/therr-text.svg').toString(),
    send: require('../svg-icons/send.svg').toString(),
    settings: require('../svg-icons/settings.svg').toString(),
    world: require('../svg-icons/world.svg').toString(),
};
/* eslint-enable global-require */

export interface IInlineSvgProps {
    className?: string;
    name: string;
}

const InlineSvg = (props: IInlineSvgProps) => {
    const { className, name } = props;

    const html = iconMap[name];

    return (<span className={(`inline-svg ${className || ''}`).trim()} dangerouslySetInnerHTML={{ __html: html }} />);
};

export default InlineSvg;
