import React from 'react';
import { Pressable, View } from 'react-native';
import { Avatar, Badge, Button, ListItem } from 'react-native-elements';
import { createIconSetFromIcoMoon } from 'react-native-vector-icons';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { GroupRequestStatuses } from 'therr-js-utilities/constants';
import therrIconConfig from '../../assets/therr-font-config.json';
import { getUserImageUri } from '../../utilities/content';
import spacingStyles from '../../styles/layouts/spacing';

const TherrIcon = createIconSetFromIcoMoon(
    therrIconConfig,
    'TherrFont',
    'TherrFont.ttf'
);

const renderChatIcon = (item, style = {}) => {
    const props = {
        key: item.tag,
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
        return (<FontAwesome5Icon {...props} />);
    }

    if (item.iconGroup === 'therr') {
        return (<TherrIcon {...props} />);
    }

    return (<MaterialIcon {...props} />);
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
    const membershipStatus = user?.myUserGroups[group.id]?.status || '';
    const onPressJoinGroup = () => {
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
                    title={`${group.title?.substring(0, 1)}`}
                    rounded
                    // TODO: Include use media in list groups response
                    source={{ uri: getUserImageUri({ details: { id: group.authorId, media: group.author?.media } }, 150) }}
                    size="medium"
                />
            </Pressable>
            <View style={spacingStyles.flexOne}>
                <ListItem.Title style={{ fontWeight: '500' }} numberOfLines={2}>{group.title}</ListItem.Title>
                {
                    group.memberCount &&
                    <ListItem.Subtitle
                        style={[{ fontWeight: '300', fontSize: 13 }, spacingStyles.marginBotSm]}
                        numberOfLines={2}>{translate('pages.groups.labels.memberCount', {
                            count: group.memberCount,
                        })}
                    </ListItem.Subtitle>
                }
                <ListItem.Subtitle numberOfLines={4}>{group.description}</ListItem.Subtitle>
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
                        badgeStyle={{ backgroundColor: theme.colors.brandingRed }}
                        value={unreadMsgCount}
                    />
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
                        />
                }
            </View>
        </ListItem>
    );
};
