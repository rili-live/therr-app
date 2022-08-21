import React from 'react';
import { Linking, Pressable, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';

export default ({
    isMe,
    iconName,
    navigation,
    themeUser,
    userInView,
}) => {
    const iconSize = 24;
    const onPress = () => {
        if (iconName === 'twitter' && userInView.socialSyncs?.twitter?.link) {
            return Linking.openURL(userInView.socialSyncs?.twitter?.link);
        }
        if (iconName === 'instagram' && userInView.socialSyncs?.instagram?.link) {
            return Linking.openURL(userInView.socialSyncs?.instagram?.link);
        }
        if (iconName === 'youtube' && userInView.socialSyncs?.youtube?.link) {
            return Linking.openURL(userInView.socialSyncs?.youtube?.link);
        }

        return isMe && navigation.navigate('SocialSync', userInView);
    };

    let iconColor = themeUser.colors.brandingBlack;
    const extraStyle1: any = {};
    const extraStyle2: any = {};
    const extraStyle3: any = {};
    const extraStyle4: any = {};

    ['twitter', 'instagram', 'youtube'].forEach((platform) => {
        if (iconName === platform && userInView.socialSyncs?.[platform]?.followerCount != null) {
            iconColor = themeUser.colors[platform];
            if (userInView.socialSyncs?.[platform]?.followerCount >= 0) {
                extraStyle1.backgroundColor = themeUser.colors.accentLime;
            }
            if (userInView.socialSyncs?.[platform]?.followerCount > 1000) {
                extraStyle2.backgroundColor = themeUser.colors.accentLime;
            }
            if (userInView.socialSyncs?.[platform]?.followerCount > 5000) {
                extraStyle3.backgroundColor = themeUser.colors.accentLime;
            }
            if (userInView.socialSyncs?.[platform]?.followerCount > 10000) {
                extraStyle4.backgroundColor = themeUser.colors.accentLime;
            }
        }
    });

    return (
        <Pressable style={themeUser.styles.socialIconPressable} onPress={onPress}>
            {
                iconName === 'instagram' && userInView.socialSyncs?.instagram?.followerCount ?
                    <View style={[themeUser.styles.socialIcon, { height: iconSize, width: iconSize }]}>
                        <MaskedView
                            style={{ flex: 1, flexDirection: 'row', height: iconSize }}
                            maskElement={
                                <View
                                    style={{
                                        backgroundColor: 'transparent',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                    }}>
                                    <FontAwesome5
                                        name={iconName}
                                        size={iconSize}
                                        color={iconColor}
                                    />
                                </View>
                            }>
                            <LinearGradient
                                angle={45}
                                useAngle={true}
                                colors={['#feda75', '#fa7e1e', '#d62976', '#962fbf', '#e1306c', '#4f5bd5']}
                                style={{ flex: 1 }}
                            />
                        </MaskedView>
                    </View>
                    :
                    <FontAwesome5
                        name={iconName}
                        size={iconSize}
                        color={iconColor}
                        style={themeUser.styles.socialIcon}
                    />
            }
            <View style={themeUser.styles.socialIndicatorsContainer}>
                <View style={[themeUser.styles.socialIndicatorOne, extraStyle1]}></View>
                <View style={[themeUser.styles.socialIndicatorTwo, extraStyle2]}></View>
                <View style={[themeUser.styles.socialIndicatorThree, extraStyle3]}></View>
                <View style={[themeUser.styles.socialIndicatorFour, extraStyle4]}></View>
            </View>
        </Pressable>
    );
};
