import React from 'react';
import { ActivityIndicator, Text, Pressable, View } from 'react-native';
import { Image } from 'react-native-elements';
import { createIconSetFromIcoMoon } from 'react-native-vector-icons';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import therrIconConfig from '../../assets/therr-font-config.json';
import * as therrTheme from '../../styles/themes';
import tileStyles from '../../styles/hosted-chat/chat-tiles';

const TherrIcon = createIconSetFromIcoMoon(
    therrIconConfig,
    'TherrFont',
    'TherrFont.ttf'
);

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
        return (<FontAwesome5Icon {...props} />);
    }

    if (item.iconGroup === 'therr') {
        return (<TherrIcon {...props} />);
    }

    return (<MaterialIcon {...props} />);
};

export default (onChatTilePress) => {
    return ({
        item: chat,
    }) => {
        return (
            <Pressable
                android_ripple={{
                    color: therrTheme.colors.beemo1,
                    radius: 20,
                    borderless: true,
                }}
                onPress={() => onChatTilePress(chat)}
                style={tileStyles.container}
            >
                <View style={tileStyles.avatarContainer}>
                    <Image
                        style={tileStyles.avatarStyle}
                        source={{ uri: `https://robohash.org/${chat.authorId}?size=75x75` }}
                        PlaceholderContent={<ActivityIndicator size="large" color={therrTheme.colors.primary} />}
                    />
                </View>
                <View style={tileStyles.contentContainer}>
                    <View style={tileStyles.header}>
                        <Text style={tileStyles.headerTitle}>{chat.title}</Text>
                    </View>
                    <View style={tileStyles.body}>
                        <Text style={tileStyles.bodyText}>{chat.description}</Text>
                    </View>
                    <View style={tileStyles.footer}>
                        <View style={tileStyles.footerIconsContainer}>
                            {
                                chat.categories.map((cat) => renderChatIcon(cat))
                            }
                        </View>
                    </View>
                </View>
            </Pressable>
        );
    };
};
