import React from 'react';
import { ActivityIndicator, Text, View, Pressable } from 'react-native';
import { Image } from 'react-native-elements';
import { FlatList } from 'react-native-gesture-handler';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { getUserImageUri } from '../../utilities/content';
import { buildStyles } from '../../styles/user-content/user-display';

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
        name: 'send-connection-request',
        icon: 'send',
        title: 'user.profile.actions.connect',
    },
    {
        id: '3',
        name: 'remove-connection-request',
        icon: 'send',
        title: 'user.profile.actions.unconnect',
    },
    {
        id: '4',
        name: 'pending-connection-request',
        icon: 'schedule',
        title: 'user.profile.actions.pendingConnection',
    },
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
    onMessageUser,
    onReportUser,
    translate,
    theme,
    userInView,
}) => {
    let contextOnPress;

    switch (item.name) {
        case 'send-connection-request':
        case 'remove-connection-request':
            contextOnPress = onConnectionRequest;
            break;
        case 'send-message':
            contextOnPress = onMessageUser;
            break;
        case 'block-user':
            contextOnPress = onBlockUser;
            break;
        case 'report-user':
            contextOnPress = onReportUser;
            break;
        default:
            contextOnPress = () => {};
    }

    return (
        <Pressable onPress={() => contextOnPress(item, userInView)} style={theme.styles.actionMenuItemContainer}>
            <View style={theme.styles.actionMenuItemIcon}>
                <MaterialIcon
                    name={item.icon}
                    size={30}
                    color={theme.colorVariations.primary3LightFade}
                />
            </View>
            <Text numberOfLines={1} style={theme.styles.actionMenuItemText}>{translate(item.title)}</Text>
        </Pressable>
    );
};

export default ({
    onBlockUser,
    onConnectionRequest,
    onMessageUser,
    onReportUser,
    onProfilePicturePress,
    translate,
    user,
    userInView,
}) => {
    // eslint-disable-next-line eqeqeq
    const isMe = user.details?.id == userInView.id;
    let actionsList = getActionableOptions(isMe, userInView);
    const theme = buildStyles(user.settings?.mobileThemeName);

    return (
        <View style={theme.styles.container}>
            <Pressable
                onPress={() => onProfilePicturePress(userInView, isMe)}
            >
                <Image
                    source={{ uri: getUserImageUri({ details: userInView }, 400) }}
                    style={theme.styles.profileImage}
                    containerStyle={{}}
                    PlaceholderContent={<ActivityIndicator size="large" color={theme.colors.primary}/>}
                    transition={false}
                />
            </Pressable>
            <FlatList
                style={theme.styles.actionMenuContainer}
                data={actionsList}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item }) => <ListItem
                    item={item}
                    onBlockUser={onBlockUser}
                    onConnectionRequest={onConnectionRequest}
                    onMessageUser={onMessageUser}
                    onReportUser={onReportUser}
                    translate={translate}
                    theme={theme}
                    userInView={userInView}
                />}
                ItemSeparatorComponent={() => <View style={theme.styles.separator} />}
                keyboardShouldPersistTaps="always"
                // ref={(component) => (this.flatListRef = component)}
                // style={styles.stretch}
                // onContentSizeChange={() => dms.length && this.flatListRef.scrollToEnd({ animated: true })}
            />
        </View>
    );
};
