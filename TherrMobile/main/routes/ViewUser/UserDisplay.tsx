import BottomSheet from '../../components/Modals/BottomSheet';
import React, { useState } from 'react';
import { ActivityIndicator, Text, View, Pressable } from 'react-native';
import { Button, Image } from 'react-native-elements';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { getUserImageUri } from '../../utilities/content';

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
    // {
    //     id: '2',
    //     name: 'send-connection-request',
    //     icon: 'send',
    //     title: 'user.profile.actions.connect',
    // },
    {
        id: '3',
        name: 'remove-connection-request',
        icon: 'send',
        title: 'user.profile.actions.unconnect',
    },
    // {
    //     id: '4',
    //     name: 'pending-connection-request',
    //     icon: 'schedule',
    //     title: 'user.profile.actions.pendingConnection',
    // },
    {
        id: '5',
        name: 'report-user',
        icon: 'flag',
        title: 'user.profile.actions.report',
    },
    {
        id: '6',
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
        case 'remove-connection-request':
            contextOnPress = (contxt, userDetails) => {
                onToggleMoreBottomSheet(false);
                onConnectionRequest(contxt, userDetails);
            };
            break;
        // case 'send-message':
        //     contextOnPress = onMessageUser;
        //     break;
        case 'block-user':
            contextOnPress = (contxt, userDetails) => {
                onToggleMoreBottomSheet(false);
                onBlockUser(contxt, userDetails);
            };
            break;
        case 'report-user':
            contextOnPress = (contxt, userDetails) => {
                onToggleMoreBottomSheet(false);
                onReportUser(contxt, userDetails);
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
            containerStyle={{ flex: 1, marginHorizontal: 16 }}
            buttonStyle={themeForms.styles.buttonPrimary}
            titleStyle={themeForms.styles.buttonTitle}
            title={buttonTitle}
            onPress={onPress}
            disabled={isDisabled}
            icon={
                <MaterialIcon
                    name={iconName}
                    size={30}
                    color={themeUser.colors.brandingWhite}
                    style={{ marginRight: 14 }}
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

export default ({
    navigation,
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
    // eslint-disable-next-line eqeqeq
    const isMe = user.details?.id == userInView.id;
    let actionsList = getActionableOptions(isMe, userInView);
    const [isMoreBottomSheetVisible, toggleMoreBottomSheet] = useState(false);
    const onToggleMoreBottomSheet = (isVisible: boolean) => {
        if (actionsList.length) {
            toggleMoreBottomSheet(isVisible);
        }
    };

    return (
        <View style={themeUser.styles.container}>
            <View style={themeUser.styles.profileInfoContainer}>
                <Pressable
                    onPress={() => onProfilePicturePress(userInView, isMe)}
                    style={themeUser.styles.profileImageContainer}
                >
                    <Image
                        source={{ uri: getUserImageUri({ details: userInView }, 400) }}
                        style={themeUser.styles.profileImage}
                        containerStyle={{}}
                        PlaceholderContent={<ActivityIndicator size="large" color={themeUser.colors.primary}/>}
                        transition={false}
                    />
                </Pressable>
                <View style={themeUser.styles.profileSummaryContainer}>
                    <FullName
                        isMe={isMe}
                        themeUser={themeUser}
                        translate={translate}
                        userInView={userInView}
                    />
                    <Text style={themeUser.styles.profileBio} numberOfLines={3}>
                        {userInView.settingsBio || translate('user.profile.labels.noBioYet')}
                    </Text>
                </View>
            </View>
            <View style={themeUser.styles.actionsContainer}>
                {
                    isMe &&
                    <Button
                        containerStyle={{ flex: 1, marginHorizontal: 16 }}
                        buttonStyle={themeForms.styles.buttonPrimary}
                        titleStyle={themeForms.styles.buttonTitle}
                        title={translate('user.profile.buttons.editProfile')}
                        onPress={() => navigation.navigate('Settings')}
                    />
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
                    containerStyle={{ marginRight: 16 }}
                    buttonStyle={[themeForms.styles.buttonRoundAlt, { width: 60 }]}
                    onPress={() => onToggleMoreBottomSheet(true)}
                    icon={
                        <MaterialIcon
                            name="more-horiz"
                            size={30}
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
        </View>
    );
};
