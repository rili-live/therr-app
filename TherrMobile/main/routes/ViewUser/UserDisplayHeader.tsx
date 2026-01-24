import BottomSheet from '../../components/BottomSheet/BottomSheet';
import React, { useState } from 'react';
import { ActivityIndicator, Text, View, Pressable, Share, Platform } from 'react-native';
import { Button, Image } from 'react-native-elements';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { getUserImageUri } from '../../utilities/content';
import SocialIconLink from './SocialIconLink';
import { createIconSetFromIcoMoon } from 'react-native-vector-icons';
import spacingStyles from '../../styles/layouts/spacing';
import therrIconConfig from '../../assets/therr-font-config.json';
import TherrIcon from '../../components/TherrIcon';
import SuperUserStatusIcon from '../../components/SuperUserStatusIcon';

const LogoIcon = createIconSetFromIcoMoon(
    therrIconConfig,
    'TherrFont',
    'TherrFont.ttf'
);

interface IActionItem {
    id: string;
    name: string;
    icon: string;
    title: string;
}

const actionMenuOptions: IActionItem[] = [
    // {
    //     id: '1',
    //     name: 'send-message',
    //     icon: 'question-answer',
    //     title: 'user.profile.actions.message',
    // },
    {
        id: '2',
        name: 'share-a-link',
        icon: 'share',
        title: 'user.profile.actions.shareALink',
    },
    {
        id: '3',
        name: 'sync-socials',
        icon: 'sync',
        title: 'user.profile.actions.syncSocials',
    },
    {
        id: '4',
        name: 'remove-connection-request',
        icon: 'send',
        title: 'user.profile.actions.unconnect',
    },
    // {
    //     id: '5',
    //     name: 'pending-connection-request',
    //     icon: 'schedule',
    //     title: 'user.profile.actions.pendingConnection',
    // },
    {
        id: '6',
        name: 'report-user',
        icon: 'flag',
        title: 'user.profile.actions.report',
    },
    {
        id: '7',
        name: 'block-user',
        icon: 'report',
        title: 'user.profile.actions.block',
    },
];

const getActionableOptions = (isMe: boolean, userInView: any) => {
    let filteredOptions = [...actionMenuOptions];
    if (isMe) {
        filteredOptions = filteredOptions
            .filter(option => ![
                'send-message',
                'send-connection-request',
                'pending-connection-request',
                'remove-connection-request',
                'report-user',
                'block-user',
            ].includes(option.name));
    } else {
        filteredOptions = filteredOptions
            .filter(option => ![
                'sync-socials',
            ].includes(option.name));
    }

    if (!userInView.isNotConnected) {
        // users are connected
        filteredOptions = filteredOptions.filter(option => !['send-connection-request', 'pending-connection-request'].includes(option.name));
    } else if (userInView.isPendingConnection) {
        // pending request
        filteredOptions = filteredOptions.filter(option => !['send-connection-request', 'remove-connection-request'].includes(option.name));
    } else {
        // users are NOT connected
        filteredOptions = filteredOptions.filter(option => !['pending-connection-request', 'remove-connection-request'].includes(option.name));
    }

    return filteredOptions;
};

const ListItem = ({
    item,
    navigation,
    onBlockUser,
    onConnectionRequest,
    // onMessageUser,
    onReportUser,
    onToggleMoreBottomSheet,
    translate,
    themeUser,
    userInView,
}) => {
    let contextOnPress;

    switch (item.name) {
        case 'sync-socials':
            contextOnPress = () => {
                onToggleMoreBottomSheet(false);
                navigation.navigate('SocialSync', userInView);
            };
            break;
        case 'remove-connection-request':
            contextOnPress = (context, userDetails) => {
                onToggleMoreBottomSheet(false);
                onConnectionRequest(context, userDetails);
            };
            break;
        // case 'send-message':
        //     contextOnPress = onMessageUser;
        //     break;
        case 'block-user':
            contextOnPress = (context, userDetails) => {
                onToggleMoreBottomSheet(false);
                onBlockUser(context, userDetails);
            };
            break;
        case 'report-user':
            contextOnPress = (context, userDetails) => {
                onToggleMoreBottomSheet(false);
                onReportUser(context, userDetails);
            };
            break;
        case 'share-a-link':
            contextOnPress = (context, userDetails) => {
                onToggleMoreBottomSheet(false);
                Share.share({
                    message: Platform.OS === 'ios' ? undefined : `https://www.therr.com/users/${userDetails.id}`,
                    url: `https://www.therr.com/users/${userDetails.id}`,
                    title: translate('modals.contentOptions.shareLink.titleUser', {
                        userName: userDetails.userName,
                    }),
                }).then((response) => {
                    if (response.action === Share.sharedAction) {
                        if (response.activityType) {
                            // shared with activity type of response.activityType
                        } else {
                            // shared
                        }
                    } else if (response.action === Share.dismissedAction) {
                        // dismissed
                    }
                }).catch((err) => {
                    console.error(err);
                });
            };
            break;
        default:
            contextOnPress = () => onToggleMoreBottomSheet(false);
    }

    return (
        <Pressable onPress={() => contextOnPress(item, userInView)} style={themeUser.styles.actionMenuItemContainer}>
            <View style={themeUser.styles.actionMenuItemIcon}>
                <MaterialIcon
                    name={item.icon}
                    size={30}
                    color={themeUser.colorVariations.primary3LightFade}
                />
            </View>
            <Text numberOfLines={1} style={themeUser.styles.actionMenuItemText}>{translate(item.title)}</Text>
        </Pressable>
    );
};

const MainActionButton = ({
    themeForms,
    themeUser,
    translate,
    onConnectionRequest,
    onMessageUser,
    userInView,
}) => {
    let buttonTitle = translate('user.profile.buttons.message');
    let onPress = () => onMessageUser({}, userInView);
    let iconName = 'send';
    let isDisabled = false;

    if (userInView.isNotConnected && !userInView.isPendingConnection) {
        buttonTitle = translate('user.profile.actions.connect');
        onPress = () => onConnectionRequest({}, userInView);
        iconName = 'person-add';
    } else if (userInView.isPendingConnection) {
        buttonTitle = translate('user.profile.actions.pendingConnection');
        onPress = () => onConnectionRequest({}, userInView);
        iconName = 'person-add';
        isDisabled = true;
    }

    return (
        <Button
            containerStyle={[spacingStyles.marginHorizLg, spacingStyles.flexOne]}
            buttonStyle={themeForms.styles.buttonPrimarySmall}
            titleStyle={[themeForms.styles.buttonTitleSmall, spacingStyles.padRtSm]}
            title={buttonTitle}
            onPress={onPress}
            disabled={isDisabled}
            icon={
                <MaterialIcon
                    name={iconName}
                    size={30}
                    color={themeUser.colors.brandingWhite}
                    style={spacingStyles.marginRtLg}
                />
            }
        />
    );
};

const FullName = ({
    isMe,
    themeUser,
    translate,
    userInView,
}) => {
    let name = '';

    if (isMe) {
        name = `${userInView.firstName} ${userInView.lastName}`;
    } else if (userInView.settingsIsProfilePublic) {
        name = `${userInView.firstName} ${userInView.lastName}`;
    } else {
        name = translate('user.profile.labels.profileIsPublicName');
    }

    return (
        <Text style={themeUser.styles.profileFullName}>{name}</Text>
    );
};

const UserDisplayHeader = ({
    goToConnections,
    navigation,
    isDarkMode,
    onBlockUser,
    onConnectionRequest,
    onMessageUser,
    onReportUser,
    onProfilePicturePress,
    themeForms,
    themeModal,
    themeUser,
    translate,
    user,
    userInView,
}) => {
    const [isMoreBottomSheetVisible, toggleMoreBottomSheet] = useState(false);

    // eslint-disable-next-line eqeqeq
    const isMe = user.details?.id == userInView.id;
    let actionsList = getActionableOptions(isMe, userInView);
    const onToggleMoreBottomSheet = (isVisible: boolean) => {
        if (actionsList.length) {
            toggleMoreBottomSheet(isVisible);
        }
    };

    return (
        <>
            <View style={themeUser.styles.profileInfoContainer}>
                <Pressable
                    onPress={() => onProfilePicturePress(userInView, isMe)}
                    style={themeUser.styles.profileImageContainer}
                >
                    <Image
                        source={{ uri: getUserImageUri({ details: userInView }, 400) }}
                        style={themeUser.styles.profileImage}
                        height={themeUser.styles.profileImage.height}
                        width={themeUser.styles.profileImage.width}
                        containerStyle={{}}
                        PlaceholderContent={<ActivityIndicator size="large" color={themeUser.colors.primary}/>}
                        transition={false}
                    />
                </Pressable>
                <View style={themeUser.styles.profileSummaryContainer}>
                    <View style={[
                        spacingStyles.flexRow,
                        spacingStyles.alignCenter,
                    ]}>
                        <FullName
                            isMe={isMe}
                            themeUser={themeUser}
                            translate={translate}
                            userInView={userInView}
                        />
                        <SuperUserStatusIcon
                            isSuperUser={userInView.isSuperUser}
                            size={16}
                            isDarkMode={isDarkMode}
                            style={[
                                {
                                    marginBottom: themeUser.styles.profileFullName.marginBottom,
                                },
                                spacingStyles.padLtSm,
                            ]}
                        />
                    </View>
                    <Text style={themeUser.styles.profileBio} numberOfLines={3}>
                        {userInView.settingsBio || translate('user.profile.labels.noBioYet')}
                    </Text>
                    {
                        !!userInView?.connectionCount &&
                        <Pressable style={themeUser.styles.connectionCountContainer} onPress={goToConnections}>
                            <LogoIcon
                                name="therr-logo"
                                size={20}
                                style={themeUser.styles.connectionCountIcon}
                            />
                            <Text style={themeUser.styles.connectionCountNumber} numberOfLines={1}>
                                {userInView?.connectionCount}
                            </Text>
                            <Text style={themeUser.styles.connectionCountText} numberOfLines={1}>
                                {translate('user.profile.labels.connections')}
                            </Text>
                        </Pressable>
                    }
                </View>
            </View>
            <View style={themeUser.styles.socialLinksContainer}>
                <SocialIconLink
                    iconName="instagram"
                    isMe={isMe}
                    navigation={navigation}
                    themeUser={themeUser}
                    userInView={userInView}
                />
                <SocialIconLink
                    iconName="tiktok"
                    isMe={isMe}
                    navigation={navigation}
                    themeUser={themeUser}
                    userInView={userInView}
                />
                <SocialIconLink
                    iconName="youtube"
                    isMe={isMe}
                    navigation={navigation}
                    themeUser={themeUser}
                    userInView={userInView}
                />
                <SocialIconLink
                    iconName="twitter"
                    isMe={isMe}
                    navigation={navigation}
                    themeUser={themeUser}
                    userInView={userInView}
                />
            </View>
            <View style={themeUser.styles.actionsContainer}>
                {
                    isMe &&
                    <>
                        <Button
                            containerStyle={[spacingStyles.marginLtLg, spacingStyles.flexOne]}
                            buttonStyle={themeForms.styles.buttonPrimarySmall}
                            titleStyle={[themeForms.styles.buttonTitleSmall, spacingStyles.padRtSm]}
                            title={translate('user.profile.buttons.syncSocials')}
                            onPress={() => navigation.navigate('SocialSync', userInView)}
                            icon={
                                <TherrIcon
                                    name="refresh"
                                    size={23}
                                    style={themeForms.styles.buttonIconSmall}
                                />
                            }
                        />
                        <Button
                            containerStyle={[spacingStyles.marginHorizLg, spacingStyles.flexOne]}
                            buttonStyle={themeForms.styles.buttonPrimarySmall}
                            titleStyle={[themeForms.styles.buttonTitleSmall, spacingStyles.padRtSm]}
                            title={translate('user.profile.buttons.editProfile')}
                            onPress={() => navigation.navigate('Settings')}
                            icon={
                                <TherrIcon
                                    name="edit"
                                    size={21}
                                    style={themeForms.styles.buttonIconSmall}
                                />
                            }
                        />
                    </>
                }
                {
                    !isMe &&
                    <MainActionButton
                        themeForms={themeForms}
                        themeUser={themeUser}
                        translate={translate}
                        onConnectionRequest={onConnectionRequest}
                        onMessageUser={onMessageUser}
                        userInView={userInView}
                    />
                }
                <Button
                    containerStyle={spacingStyles.marginRtLg}
                    buttonStyle={[themeForms.styles.buttonRoundAltSmall, themeForms.styles.buttonRoundAltSmallWidth]}
                    onPress={() => onToggleMoreBottomSheet(true)}
                    icon={
                        <TherrIcon
                            name="dots-horiz"
                            size={23}
                            color={themeUser.colors.brandingBlueGreen}
                        />
                    }
                />
            </View>
            <BottomSheet
                isVisible={isMoreBottomSheetVisible}
                onRequestClose={() => onToggleMoreBottomSheet(!isMoreBottomSheetVisible)}
                themeModal={themeModal}
            >
                {
                    actionsList.map((item) => <ListItem
                        key={item.id}
                        item={item}
                        navigation={navigation}
                        onBlockUser={onBlockUser}
                        onConnectionRequest={onConnectionRequest}
                        // onMessageUser={onMessageUser}
                        onReportUser={onReportUser}
                        onToggleMoreBottomSheet={onToggleMoreBottomSheet}
                        translate={translate}
                        themeUser={themeUser}
                        userInView={userInView}
                    />)
                }
            </BottomSheet>
        </>
    );
};

export default React.memo(UserDisplayHeader);
