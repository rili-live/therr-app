import React from 'react';
import { Pressable, View } from 'react-native';
import { Avatar, Badge, ListItem } from 'react-native-elements';
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
            onPress={() => onConnectionPress(connectionDetails)}
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
            <View style={spacingStyles.flexOne}>
                <ListItem.Title>{connectionDetails.userName}</ListItem.Title>
                <ListItem.Subtitle>{getConnectionSubtitle(connectionDetails) || translate('pages.userProfile.anonymous')}</ListItem.Subtitle>
            </View>
            {
                isActive ?
                    <Badge
                        badgeStyle={{ backgroundColor: theme.colors.accentLime }}
                    /> :
                    <Badge
                        badgeStyle={{ backgroundColor: theme.colors.accentDivider }}
                    />
            }
        </ListItem>
    );
};

export default ConnectionItem;
