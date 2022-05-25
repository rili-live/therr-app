import React from 'react';
import { Linking, Pressable, View } from 'react-native';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';

export default ({
    isMe,
    iconName,
    navigation,
    themeUser,
    userInView,
}) => {
    const onPress = () => {
        if (iconName === 'twitter' && userInView.socialSyncs?.twitter?.link) {
            return Linking.openURL(userInView.socialSyncs?.twitter?.link);
        }
        if (iconName === 'instagram' && userInView.socialSyncs?.instagram?.link) {
            return Linking.openURL(userInView.socialSyncs?.instagram?.link);
        }

        return isMe && navigation.navigate('SocialSync', userInView);
    };

    let iconColor = themeUser.colors.brandingBlack;
    const extraStyle1: any = {};
    const extraStyle2: any = {};
    const extraStyle3: any = {};

    if (iconName === 'twitter' && userInView.socialSyncs?.twitter?.followerCount) {
        iconColor = themeUser.colors.twitter;
        if (userInView.socialSyncs?.twitter?.followerCount > 0) {
            extraStyle1.backgroundColor = themeUser.colors.accentLime;
        }
        if (userInView.socialSyncs?.twitter?.followerCount > 2500) {
            extraStyle2.backgroundColor = themeUser.colors.accentLime;
        }
        if (userInView.socialSyncs?.twitter?.followerCount > 10000) {
            extraStyle3.backgroundColor = themeUser.colors.accentLime;
        }
    }

    if (iconName === 'instagram' && userInView.socialSyncs?.instagram?.followerCount) {
        iconColor = themeUser.colors.instagram;
        if (userInView.socialSyncs?.instagram?.followerCount > 0) {
            extraStyle1.backgroundColor = themeUser.colors.accentLime;
        }
        if (userInView.socialSyncs?.instagram?.followerCount > 2500) {
            extraStyle2.backgroundColor = themeUser.colors.accentLime;
        }
        if (userInView.socialSyncs?.instagram?.followerCount > 10000) {
            extraStyle3.backgroundColor = themeUser.colors.accentLime;
        }
    }

    return (
        <Pressable style={themeUser.styles.socialIconPressable} onPress={onPress}>
            <FontAwesome5
                name={iconName}
                size={24}
                color={iconColor}
                style={themeUser.styles.socialIcon}
            />
            <View style={themeUser.styles.socialIndicatorsContainer}>
                <View style={[themeUser.styles.socialIndicatorOne, extraStyle1]}></View>
                <View style={[themeUser.styles.socialIndicatorTwo, extraStyle2]}></View>
                <View style={[themeUser.styles.socialIndicatorThree, extraStyle3]}></View>
            </View>
        </Pressable>
    );
};
