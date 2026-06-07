import React from 'react';
import { Pressable, View } from 'react-native';
import { Button } from '../../../components/BaseButton';
import { Avatar } from '../../../components/BaseAvatar';
import { ListItem } from '../../../components/BaseListItem';
import 'react-native-gesture-handler';
import { IUserState } from 'therr-react/types';
import { getUserImageUri } from '../../../utilities/content';
import { ITherrThemeColors } from '../../../styles/themes';
import spacingStyles from '../../../styles/layouts/spacing';

interface IUserSearchItemProps {
    user: IUserState;
    userDetails: any; // Search Item
    getUserSubtitle: any;
    goToViewUser: any;
    onSendConnectRequest: any;
    theme: {
        colors: ITherrThemeColors;
        styles: any;
    },
    themeButtons: {
        colors: ITherrThemeColors;
        styles: any;
    },
    translate: any;
}

const UserSearchItem: React.FunctionComponent<IUserSearchItemProps> = ({
    user,
    userDetails,
    getUserSubtitle,
    goToViewUser,
    onSendConnectRequest,
    theme,
    themeButtons,
    translate,
}) => {
    const [isConnecting, setIsConnecting] = React.useState(false);
    const handleConnectionRequest = () => {
        setIsConnecting(true);
        onSendConnectRequest(userDetails);
    };
    const isMe = user.details?.id === userDetails.id;

    return (
        <ListItem
            onPress={() => goToViewUser(userDetails.id)}
            bottomDivider
            containerStyle={theme.styles.listItemCard}
        >
            <Pressable
                onPress={() => goToViewUser(userDetails.id)}
            >
                <Avatar
                    title={`${userDetails.firstName?.substring(0, 1)}${userDetails.lastName?.substring(0, 1)}`}
                    rounded
                    source={{
                        uri: getUserImageUri({ details: userDetails }, 150),
                    }}
                    size="medium"
                />
            </Pressable>
            <View style={spacingStyles.flexOne}>
                <ListItem.Title>{userDetails.userName}</ListItem.Title>
                <ListItem.Subtitle>{getUserSubtitle(userDetails) || translate('pages.userProfile.anonymous')}</ListItem.Subtitle>
            </View>
            <View>
                {
                    !userDetails.isConnected && !isMe &&
                        <Button
                            onPress={handleConnectionRequest}
                            containerStyle={themeButtons.styles.buttonPillContainerSquare}
                            buttonStyle={themeButtons.styles.buttonPill}
                            titleStyle={themeButtons.styles.buttonPillTitle}
                            title={translate('menus.connections.buttons.connect')}
                            loading={isConnecting}
                            disabled={isConnecting}
                        />
                }
            </View>
        </ListItem>
    );
};

// Custom equality: parent passes inline arrow handlers per render; compare the
// fields that drive the visible row instead of the function refs.
export default React.memo(UserSearchItem, (prev, next) => (
    prev.userDetails?.id === next.userDetails?.id
    && prev.userDetails?.userName === next.userDetails?.userName
    && prev.userDetails?.firstName === next.userDetails?.firstName
    && prev.userDetails?.lastName === next.userDetails?.lastName
    && prev.userDetails?.isConnected === next.userDetails?.isConnected
    && prev.user.details?.id === next.user.details?.id
    && prev.theme === next.theme
    && prev.themeButtons === next.themeButtons
));
