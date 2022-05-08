import React from 'react';
import { ActivityIndicator, Text, View, Pressable } from 'react-native';
import { Button, Image } from 'react-native-elements';
import { FlatList } from 'react-native-gesture-handler';
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
    themeUser,
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

export default ({
    navigation,
    onBlockUser,
    onConnectionRequest,
    onMessageUser,
    onReportUser,
    onProfilePicturePress,
    themeForms,
    themeUser,
    translate,
    user,
    userInView,
}) => {
    // eslint-disable-next-line eqeqeq
    const isMe = user.details?.id == userInView.id;
    let actionsList = getActionableOptions(isMe, userInView);

    return (
        <View style={themeUser.styles.container}>
            <Pressable
                onPress={() => onProfilePicturePress(userInView, isMe)}
            >
                <Image
                    source={{ uri: getUserImageUri({ details: userInView }, 400) }}
                    style={themeUser.styles.profileImage}
                    containerStyle={{}}
                    PlaceholderContent={<ActivityIndicator size="large" color={themeUser.colors.primary}/>}
                    transition={false}
                />
            </Pressable>
            {
                isMe &&
                <View>
                    <Button
                        containerStyle={{ marginVertical: 10 }}
                        buttonStyle={themeForms.styles.buttonPrimary}
                        titleStyle={themeForms.styles.buttonTitle}
                        title={translate('user.profile.buttons.editProfile')}
                        onPress={() => navigation.navigate('Settings')}
                    />
                </View>
            }
            <FlatList
                style={themeUser.styles.actionMenuContainer}
                data={actionsList}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item }) => <ListItem
                    item={item}
                    onBlockUser={onBlockUser}
                    onConnectionRequest={onConnectionRequest}
                    onMessageUser={onMessageUser}
                    onReportUser={onReportUser}
                    translate={translate}
                    themeUser={themeUser}
                    userInView={userInView}
                />}
                ItemSeparatorComponent={() => <View style={themeUser.styles.separator} />}
                keyboardShouldPersistTaps="always"
                // ref={(component) => (this.flatListRef = component)}
                // style={styles.stretch}
                // onContentSizeChange={() => dms.length && this.flatListRef.scrollToEnd({ animated: true })}
            />
        </View>
    );
};
