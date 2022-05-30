import React from 'react';
import { Avatar, ListItem } from 'react-native-elements';
import 'react-native-gesture-handler';
import { getUserImageUri } from '../../utilities/content';

interface IConnectionItemProps {
    connectionDetails: any;
    getConnectionSubtitle: any;
    onConnectionPress: any;
    theme: {
        styles: any;
    },
    translate: any;
}

const ConnectionItem: React.FunctionComponent<IConnectionItemProps> = ({
    connectionDetails,
    getConnectionSubtitle,
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
            <Avatar
                title={`${connectionDetails.firstName?.substring(0, 1)}${connectionDetails.lastName?.substring(0, 1)}`}
                rounded
                source={{
                    uri: getUserImageUri({ details: connectionDetails }, 100),
                }}
                size="small"
            />
            <ListItem.Content>
                <ListItem.Title>{connectionDetails.userName}</ListItem.Title>
                <ListItem.Subtitle>{getConnectionSubtitle(connectionDetails) || translate('pages.userProfile.anonymous')}</ListItem.Subtitle>
            </ListItem.Content>
        </ListItem>
    );
};

export default ConnectionItem;
