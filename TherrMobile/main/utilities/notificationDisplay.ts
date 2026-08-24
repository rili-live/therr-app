import { Notifications as NotificationEnums } from 'therr-js-utilities/constants';
import { ITherrThemeColors } from '../styles/themes';

/**
 * Visual identity for a notification row.
 *
 * Every notification in the list used to render as an undifferentiated block of
 * text, so a reward, a connection request and a group invite were impossible to
 * tell apart while scanning. Each type now carries a leading icon plus a color
 * "tone", which the stylesheet renders as an icon on a tinted circle.
 *
 * Tones are semantic, not literal colors — they resolve against the active
 * theme so the same mapping works in light, dark and retro, and on any brand.
 */
export type INotificationTone = 'reward' | 'social' | 'engagement' | 'discovery' | 'message';

export interface INotificationDisplay {
    /** FontAwesome5 icon name. */
    icon: string;
    tone: INotificationTone;
}

const DEFAULT_DISPLAY: INotificationDisplay = {
    icon: 'bell',
    tone: 'engagement',
};

const DISPLAY_BY_TYPE: { [key: string]: INotificationDisplay } = {
    [NotificationEnums.Types.ACHIEVEMENT_COMPLETED]: { icon: 'trophy', tone: 'reward' },
    [NotificationEnums.Types.CONNECTION_REQUEST_ACCEPTED]: { icon: 'user-check', tone: 'social' },
    [NotificationEnums.Types.CONNECTION_REQUEST_RECEIVED]: { icon: 'user-plus', tone: 'social' },
    [NotificationEnums.Types.NEW_LIKE_RECEIVED]: { icon: 'heart', tone: 'engagement' },
    [NotificationEnums.Types.NEW_SUPER_LIKE_RECEIVED]: { icon: 'star', tone: 'engagement' },
    [NotificationEnums.Types.NEW_DM_RECEIVED]: { icon: 'comment-dots', tone: 'message' },
    [NotificationEnums.Types.NEW_AREAS_ACTIVATED]: { icon: 'map-marked-alt', tone: 'discovery' },
    [NotificationEnums.Types.NEW_GROUP_INVITE]: { icon: 'users', tone: 'social' },
    [NotificationEnums.Types.NEW_GROUP_MEMBERS]: { icon: 'user-friends', tone: 'social' },
    [NotificationEnums.Types.DISCOVERED_UNIQUE_MOMENT]: { icon: 'gem', tone: 'discovery' },
    [NotificationEnums.Types.DISCOVERED_UNIQUE_SPACE]: { icon: 'map-pin', tone: 'discovery' },
    [NotificationEnums.Types.THOUGHT_REPLY]: { icon: 'reply', tone: 'message' },
    [NotificationEnums.Types.THOUGHT_REPOST]: { icon: 'retweet', tone: 'engagement' },
    [NotificationEnums.Types.INVITE_FRIENDS_REMINDER]: { icon: 'paper-plane', tone: 'social' },
};

export const getNotificationDisplay = (type?: string): INotificationDisplay =>
    (type && DISPLAY_BY_TYPE[type]) || DEFAULT_DISPLAY;

/**
 * Resolves a tone to a foreground color from the active theme. The stylesheet
 * derives the matching tinted background by fading this same value, so the pair
 * always stays in the same hue family.
 */
export const getToneColor = (tone: INotificationTone, colors: ITherrThemeColors): string => {
    switch (tone) {
        case 'reward':
            return colors.accent;
        case 'social':
            return colors.brand;
        case 'discovery':
            return colors.accentTeal;
        case 'message':
            return colors.accentBlue;
        case 'engagement':
        default:
            return colors.brandDark;
    }
};
