import React from 'react';
import { ActivityIndicator, Text, Pressable, View } from 'react-native';
import { Image } from 'react-native-elements';
import { createIconSetFromIcoMoon } from 'react-native-vector-icons';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import therrIconConfig from '../../assets/therr-font-config.json';
import { getUserImageUri } from '../../utilities/content';

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

export default (onChatTilePress, theme, themeChatTile) => {
    return ({
        item: chat,
    }) => {
        return (
            <Pressable
                android_ripple={{
                    color: theme.colors.accent1,
                    radius: 20,
                    borderless: true,
                }}
                onPress={() => onChatTilePress(chat)}
                style={themeChatTile.style.container}
            >
                <View style={themeChatTile.style.avatarContainer}>
                    <Image
                        style={themeChatTile.style.avatarStyle}
                        source={{ uri: getUserImageUri({ details: { id: chat.authorId } }, 50) }}
                        PlaceholderContent={<ActivityIndicator size="large" color={theme.colors.primary} />}
                    />
                </View>
                <View style={themeChatTile.style.contentContainer}>
                    <View style={themeChatTile.style.header}>
                        <Text style={themeChatTile.style.headerTitle}>{chat.title}</Text>
                    </View>
                    <View style={themeChatTile.style.body}>
                        <Text style={themeChatTile.style.bodyText}>{chat.description}</Text>
                    </View>
                    <View style={themeChatTile.style.footer}>
                        <View style={themeChatTile.style.footerIconsContainer}>
                            {
                                chat.categories && chat.categories.map((cat) => renderChatIcon(cat))
                            }
                        </View>
                    </View>
                </View>
            </Pressable>
        );
    };
};
