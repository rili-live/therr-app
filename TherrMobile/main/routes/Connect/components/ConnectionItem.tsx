import React from 'react';
import { Pressable } from 'react-native';
import { Avatar } from '../../../components/BaseAvatar';
import { ListItem } from '../../../components/BaseListItem';
import { Badge } from 'react-native-paper';
import 'react-native-gesture-handler';
import { getUserImageUri } from '../../../utilities/content';
import { ITherrThemeColors } from '../../../styles/themes';
import spacingStyles from '../../../styles/layouts/spacing';

interface IConnectionItemProps {
    connectionDetails: any;
    getConnectionSubtitle: any;
    goToViewUser: any;
    isActive: boolean;
    onConnectionPress: any;
    theme: {
        colors: ITherrThemeColors;
        styles: any;
    },
    translate: any;
}

const ConnectionItem: React.FunctionComponent<IConnectionItemProps> = ({
    connectionDetails,
    getConnectionSubtitle,
    goToViewUser,
    isActive,
    onConnectionPress,
    theme,
    translate,
}) => {
    return (
        <ListItem
            bottomDivider
            containerStyle={theme.styles.listItemCard}
        >
            <Pressable
                onPress={() => goToViewUser(connectionDetails.id)}
            >
                <Avatar
                    title={`${connectionDetails.firstName?.substring(0, 1)}${connectionDetails.lastName?.substring(0, 1)}`}
                    rounded
                    source={{
                        uri: getUserImageUri({ details: connectionDetails }, 150),
                    }}
                    size="medium"
                />
            </Pressable>
            <Pressable
                style={spacingStyles.flexOne}
                onPress={() => goToViewUser(connectionDetails.id)}
            >
                <ListItem.Title numberOfLines={1}>{connectionDetails.userName}</ListItem.Title>
                {/*
                  * Clamped because the Messages tab reuses this row with a ~100 character
                  * message preview as its subtitle. Unclamped it wraps to however many lines
                  * the message needs, so every row is a different height — which is what
                  * FlashList's recycler cannot estimate, and what shows up as uneven gaps
                  * between items.
                  */}
                <ListItem.Subtitle numberOfLines={2}>
                    {getConnectionSubtitle(connectionDetails) || translate('pages.userProfile.anonymous')}
                </ListItem.Subtitle>
            </Pressable>
            <Pressable onPress={() => onConnectionPress(connectionDetails)}>
                {
                    isActive ?
                        <Badge
                            size={12}
                            style={{ backgroundColor: theme.colors.accentLime, alignSelf: 'center' }}
                        /> :
                        <Badge
                            size={12}
                            style={{ backgroundColor: theme.colors.accentDivider, alignSelf: 'center' }}
                        />
                }
            </Pressable>
        </ListItem>
    );
};

// Custom equality: parent passes inline arrow handlers per render so a default
// shallow compare would re-render every row on every parent render. Compare the
// fields that actually drive what's drawn instead.
export default React.memo(ConnectionItem, (prev, next) => (
    prev.connectionDetails?.id === next.connectionDetails?.id
    && prev.connectionDetails?.userName === next.connectionDetails?.userName
    && prev.connectionDetails?.firstName === next.connectionDetails?.firstName
    && prev.connectionDetails?.lastName === next.connectionDetails?.lastName
    && prev.isActive === next.isActive
    && prev.theme === next.theme
));
