import React from 'react';
import { Pressable, View } from 'react-native';
import { Avatar, Badge, ListItem } from 'react-native-elements';
import { createIconSetFromIcoMoon } from 'react-native-vector-icons';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
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
    themeChatTile,
    group,
    isActive,
}) => (
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
                source={{ uri: getUserImageUri({ details: { id: group.authorId } }, 150) }}
                size="medium"
            />
        </Pressable>
        <View style={spacingStyles.flexOne}>
            <ListItem.Title>{group.title}</ListItem.Title>
            <ListItem.Subtitle>{group.description}</ListItem.Subtitle>
            <View style={themeChatTile.styles.footer}>
                <View style={themeChatTile.styles.footerIconsContainer}>
                    {
                        group.categories && group.categories.map((cat) => renderChatIcon(cat))
                    }
                </View>
            </View>
        </View>
        {
            isActive ?
                <Badge
                    badgeStyle={{ backgroundColor: theme.colors.accentLime }}
                /> :
                <Badge
                    badgeStyle={{ backgroundColor: theme.colors.accentDivider }}
                />
        }
    </ListItem>
);
