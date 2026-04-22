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
                <ListItem.Title>{connectionDetails.userName}</ListItem.Title>
                <ListItem.Subtitle>{getConnectionSubtitle(connectionDetails) || translate('pages.userProfile.anonymous')}</ListItem.Subtitle>
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

export default ConnectionItem;
