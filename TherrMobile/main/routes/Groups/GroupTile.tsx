import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button } from '../../components/BaseButton';
import { Avatar } from '../../components/BaseAvatar';
import { createIconSetFromIcoMoon } from 'react-native-vector-icons';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { GroupRequestStatuses } from 'therr-js-utilities/constants';
import therrIconConfig from '../../assets/therr-font-config.json';
import { getUserContentUri } from '../../utilities/content';
import { hoursDaysOrYearsSince } from '../../utilities/formatDate';
import { GROUP_AVATAR_SIZE } from '../../styles/user-content/groups/chat-tiles';
import {
    formatUnreadCount, getCategoryLabel, getDisplayTitle, getFallbackAvatarColor, getLastMessagePreview, getTitleInitial,
} from './groupUtils';

const TherrIcon = createIconSetFromIcoMoon(
    therrIconConfig,
    'TherrFont',
    'TherrFont.ttf'
);

// Chips beyond this collapse into a "+N" chip, so a group tagged with every category
// does not grow a second row of chips.
const MAX_VISIBLE_CATEGORIES = 2;

const renderCategoryIcon = (category, color: string) => {
    const props = {
        color,
        name: category.iconId,
        size: 11,
    };

    if (category.iconGroup === 'font-awesome-5') {
        return (<FontAwesome5Icon {...props} />);
    }

    if (category.iconGroup === 'therr') {
        return (<TherrIcon {...props} />);
    }

    return (<MaterialIcon {...props} />);
};

/**
 * A group's own image, or a lettered circle when it has none.
 *
 * This deliberately never falls back to the author's profile photo: that made the list read as a
 * list of people (and repeated the app logo for authors with no photo) rather than of communities.
 */
const GroupAvatar = ({ group, theme, themeChatTile }) => {
    if (group.media?.featuredImage) {
        return (
            <Avatar
                title={getTitleInitial(group.title)}
                source={{ uri: getUserContentUri(group.media.featuredImage, 150, 150) }}
                size={GROUP_AVATAR_SIZE}
            />
        );
    }

    const backgroundColor = getFallbackAvatarColor(group.id, [
        theme.colors.brand,
        theme.colors.accentBlue,
        theme.colors.brandingOrange,
    ]);

    return (
        <View style={[themeChatTile.styles.avatarFallback, { backgroundColor }]}>
            <Text style={themeChatTile.styles.avatarFallbackText}>{getTitleInitial(group.title)}</Text>
        </View>
    );
};

const GroupTile = ({
    onChatTilePress,
    theme,
    themeChatTile,
    translate,
    group,
    handleJoinGroup,
    isJoinedLabelShown = false,
    isInboxRow = false,
    user,
}: any) => {
    const [isJoining, setIsJoining] = React.useState(false);
    const membershipStatus = user?.myUserGroups?.[group.id]?.status || '';
    const onPressJoinGroup = () => {
        setIsJoining(true);
        handleJoinGroup(group);
    };
    const isUserInGroup = membershipStatus === GroupRequestStatuses.APPROVED;
    const isJoinShown = !isUserInGroup && membershipStatus !== GroupRequestStatuses.REMOVED;
    const title = getDisplayTitle(group.title);

    const memberCount = Number(group.memberCount) || 0;
    const metaParts: string[] = [];
    if (memberCount > 0) {
        metaParts.push(memberCount === 1
            ? translate('pages.groups.labels.memberCountOne')
            : translate('pages.groups.labels.memberCount', { count: memberCount }));
    }
    const location = [group.city, group.region].filter(Boolean).join(', ');
    if (location) {
        metaParts.push(location);
    }

    if (isInboxRow) {
        const unreadCount = Number(group.unreadCount) || 0;
        const isUnread = unreadCount > 0;
        const lastMessage = group.lastMessage;
        const preview = getLastMessagePreview(translate, lastMessage, user?.details?.id);
        const timeLabel = lastMessage?.createdAt
            ? hoursDaysOrYearsSince(new Date(lastMessage.createdAt), translate)
            : '';
        const a11yParts = [title, preview];
        if (isUnread) {
            a11yParts.push(translate('pages.groups.labels.unreadCount', { count: unreadCount }));
        }

        return (
            <Pressable
                onPress={() => onChatTilePress(group)}
                style={({ pressed }) => [themeChatTile.styles.row, pressed && themeChatTile.styles.rowPressed]}
                accessibilityRole="button"
                accessibilityLabel={a11yParts.join(', ')}
            >
                <GroupAvatar group={group} theme={theme} themeChatTile={themeChatTile} />
                <View style={themeChatTile.styles.rowContent}>
                    <View style={themeChatTile.styles.inboxTitleRow}>
                        <Text
                            style={[
                                themeChatTile.styles.rowTitle,
                                themeChatTile.styles.inboxTitle,
                                isUnread && themeChatTile.styles.rowTitleUnread,
                            ]}
                            numberOfLines={1}
                        >
                            {title}
                        </Text>
                        {
                            !!timeLabel &&
                            <Text style={[themeChatTile.styles.rowTime, isUnread && themeChatTile.styles.rowTimeUnread]}>
                                {timeLabel}
                            </Text>
                        }
                    </View>
                    <View style={themeChatTile.styles.inboxPreviewRow}>
                        <Text
                            style={[
                                themeChatTile.styles.rowPreview,
                                isUnread && themeChatTile.styles.rowPreviewUnread,
                                !lastMessage && themeChatTile.styles.rowPreviewEmpty,
                            ]}
                            numberOfLines={2}
                        >
                            {preview}
                        </Text>
                        {
                            isUnread &&
                            <View style={themeChatTile.styles.unreadBadge}>
                                <Text style={themeChatTile.styles.unreadBadgeText}>{formatUnreadCount(unreadCount)}</Text>
                            </View>
                        }
                    </View>
                </View>
                <View style={themeChatTile.styles.rowDivider} pointerEvents="none" />
            </Pressable>
        );
    }

    const categories: any[] = group.categories || [];
    const visibleCategories = categories.slice(0, MAX_VISIBLE_CATEGORIES);
    const hiddenCategoryCount = categories.length - visibleCategories.length;
    const chipIconColor = theme.colors.onSurfaceMuted;

    return (
        <Pressable
            onPress={() => onChatTilePress(group)}
            style={({ pressed }) => [themeChatTile.styles.row, pressed && themeChatTile.styles.rowPressed]}
            accessibilityRole="button"
            accessibilityLabel={[title, ...metaParts].join(', ')}
        >
            <GroupAvatar group={group} theme={theme} themeChatTile={themeChatTile} />
            <View style={themeChatTile.styles.rowContent}>
                <Text style={themeChatTile.styles.rowTitle} numberOfLines={2}>{title}</Text>
                {
                    metaParts.length > 0 &&
                    <Text style={themeChatTile.styles.rowMeta} numberOfLines={1}>{metaParts.join(' · ')}</Text>
                }
                {
                    !!group.description &&
                    <Text style={themeChatTile.styles.rowDescription} numberOfLines={2}>{group.description}</Text>
                }
                {
                    categories.length > 0 &&
                    <View style={themeChatTile.styles.chipsRow}>
                        {
                            visibleCategories.map((category) => (
                                <View key={category.tag} style={themeChatTile.styles.chip}>
                                    {!!category.iconId && renderCategoryIcon(category, chipIconColor)}
                                    <Text style={themeChatTile.styles.chipText}>{getCategoryLabel(translate, category)}</Text>
                                </View>
                            ))
                        }
                        {
                            hiddenCategoryCount > 0 &&
                            <View style={themeChatTile.styles.chip}>
                                <Text style={themeChatTile.styles.chipText}>{`+${hiddenCategoryCount}`}</Text>
                            </View>
                        }
                    </View>
                }
            </View>
            {
                isJoinShown &&
                <View style={themeChatTile.styles.rowAction}>
                    <Button
                        onPress={onPressJoinGroup}
                        type="outline"
                        variant="primary"
                        size="sm"
                        shape="pill"
                        title={
                            translate(membershipStatus === GroupRequestStatuses.PENDING
                                ? 'menus.connections.buttons.accept'
                                : 'menus.connections.buttons.join')
                        }
                        accessibilityLabel={translate('pages.groups.labels.joinGroup', { title })}
                        loading={isJoining}
                        disabled={isJoining}
                    />
                </View>
            }
            {
                isUserInGroup && isJoinedLabelShown &&
                <View style={themeChatTile.styles.joinedBadge}>
                    <MaterialIcon name="check" size={16} color={theme.colors.brand} />
                    <Text style={themeChatTile.styles.joinedText}>{translate('pages.groups.labels.joined')}</Text>
                </View>
            }
            <View style={themeChatTile.styles.rowDivider} pointerEvents="none" />
        </Pressable>
    );
};

// Custom equality: parent passes inline arrow handlers per render. Compare the
// fields that drive the visible row instead of churning function refs.
export default React.memo(GroupTile, (prev, next) => (
    prev.group?.id === next.group?.id
    && prev.group?.title === next.group?.title
    && prev.group?.description === next.group?.description
    && prev.group?.memberCount === next.group?.memberCount
    && prev.group?.city === next.group?.city
    && prev.group?.media?.featuredImage === next.group?.media?.featuredImage
    && prev.group?.categories === next.group?.categories
    && prev.isJoinedLabelShown === next.isJoinedLabelShown
    && prev.isInboxRow === next.isInboxRow
    && prev.group?.unreadCount === next.group?.unreadCount
    && prev.group?.lastMessage?.id === next.group?.lastMessage?.id
    && prev.user?.myUserGroups?.[prev.group?.id]?.status === next.user?.myUserGroups?.[next.group?.id]?.status
    && prev.theme === next.theme
    && prev.themeChatTile === next.themeChatTile
));
