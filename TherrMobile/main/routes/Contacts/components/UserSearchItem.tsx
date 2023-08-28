import React from 'react';
import { Pressable, View } from 'react-native';
import { Avatar, Badge, ListItem } from 'react-native-elements';
import 'react-native-gesture-handler';
import { getUserImageUri } from '../../../utilities/content';
import { ITherrThemeColors } from '../../../styles/themes';
import spacingStyles from '../../../styles/layouts/spacing';

interface IUserSearchItemProps {
    userDetails: any;
    getUserSubtitle: any;
    goToViewUser: any;
    theme: {
        colors: ITherrThemeColors;
        styles: any;
    },
    translate: any;
}

const UserSearchItem: React.FunctionComponent<IUserSearchItemProps> = ({
    userDetails,
    getUserSubtitle,
    goToViewUser,
    theme,
    translate,
}) => {
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
            <Badge
                badgeStyle={{ backgroundColor: theme.colors.accentDivider }}
            />
        </ListItem>
    );
};

export default UserSearchItem;
