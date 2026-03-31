import React from 'react';
import { Pressable, View } from 'react-native';
import { Button } from '../../components/BaseButton';
import { Avatar } from '../../components/BaseAvatar';
import { ListItem } from '../../components/BaseListItem';
import { Badge } from 'react-native-paper';
import { createIconSetFromIcoMoon } from 'react-native-vector-icons';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { GroupRequestStatuses } from 'therr-js-utilities/constants';
import therrIconConfig from '../../assets/therr-font-config.json';
import { getUserContentUri, getUserImageUri } from '../../utilities/content';
import spacingStyles from '../../styles/layouts/spacing';

const TherrIcon = createIconSetFromIcoMoon(
    therrIconConfig,
    'TherrFont',
    'TherrFont.ttf'
);

const getDisplayTitle = (title: any): string =>
    typeof title === 'object' ? (title?.title || title?.name || '') : (title || '');

const renderChatIcon = (item, style = {}) => {
    const props = {
        color: item.iconColor,
        name: item.iconId,
        size: 14,
        style: [{
            elevation: 1,
            textShadowColor: '#00000026',
            textShadowOffset: { width: 1, height: 1 },
            textShadowRadius: 1,
            padding: 4,
        }, style],
    };

    if (item.iconGroup === 'font-awesome-5') {
        return (<FontAwesome5Icon key={item.tag} {...props} />);
    }

    if (item.iconGroup === 'therr') {
        return (<TherrIcon key={item.tag} {...props} />);
    }

    return (<MaterialIcon key={item.tag} {...props} />);
};

export default ({
    onChatTilePress,
    theme,
    themeButtons,
    themeChatTile,
    translate,
    group,
    handleJoinGroup,
    user,
}) => {
    const [isJoining, setIsJoining] = React.useState(false);
    const membershipStatus = user?.myUserGroups?.[group.id]?.status || '';
    const onPressJoinGroup = () => {
        setIsJoining(true);
        handleJoinGroup(group);
    };
    const unreadMsgCount = 0;
    const isUserInGroup = membershipStatus === GroupRequestStatuses.APPROVED;

    return (
        <ListItem
            onPress={() => onChatTilePress(group)}
            bottomDivider
            containerStyle={theme.styles.listItemCard}
        >
            <Pressable
                onPress={() => onChatTilePress(group)}
            >
                <Avatar
                    title={`${getDisplayTitle(group.title)?.substring(0, 1)}`}
                    rounded
                    source={{
                        uri: group.media?.featuredImage
                            ? getUserContentUri(group.media.featuredImage, 150, 150)
                            : getUserImageUri({ details: { id: group.authorId, media: group.author?.media } }, 150),
                    }}
                    size="medium"
                />
            </Pressable>
            <View style={spacingStyles.flexOne}>
                <ListItem.Title style={{ fontWeight: '500' }} numberOfLines={2}>{getDisplayTitle(group.title)}</ListItem.Title>
                {
                    group.city &&
                    <ListItem.Subtitle
                        style={{ fontWeight: '400', fontSize: 12, color: '#888', marginBottom: 2 }}
                        numberOfLines={1}
                    >
                        {[group.city, group.region].filter(Boolean).join(', ')}
                    </ListItem.Subtitle>
                }
                {
                    group.memberCount > 0 &&
                    <ListItem.Subtitle
                        style={[{ fontWeight: '300', fontSize: 13 }, spacingStyles.marginBotSm]}
                        numberOfLines={2}>{translate('pages.groups.labels.memberCount', {
                            count: group.memberCount,
                        })}
                    </ListItem.Subtitle>
                }
                <ListItem.Subtitle numberOfLines={3}>{group.description}</ListItem.Subtitle>
                <View style={themeChatTile.styles.footer}>
                    <View style={themeChatTile.styles.footerIconsContainer}>
                        {
                            group.categories && group.categories.map((cat) => renderChatIcon(cat))
                        }
                    </View>
                </View>
            </View>
            {
                isUserInGroup && unreadMsgCount > 0 &&
                    <Badge
                        style={{ backgroundColor: theme.colors.brandingRed }}
                    >
                        {unreadMsgCount}
                    </Badge>
            }
            <View>
                {
                    !isUserInGroup && membershipStatus !== GroupRequestStatuses.REMOVED &&
                        <Button
                            onPress={onPressJoinGroup}
                            containerStyle={themeButtons.styles.buttonPillContainerSquare}
                            buttonStyle={themeButtons.styles.buttonPill}
                            titleStyle={themeButtons.styles.buttonPillTitle}
                            title={
                                translate(membershipStatus === GroupRequestStatuses.PENDING
                                    ? 'menus.connections.buttons.accept'
                                    : 'menus.connections.buttons.join')
                            }
                            loading={isJoining}
                            disabled={isJoining}
                        />
                }
            </View>
        </ListItem>
    );
};
