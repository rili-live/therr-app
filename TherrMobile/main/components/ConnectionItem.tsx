import React from 'react';
import { Avatar, ListItem } from 'react-native-elements';
import 'react-native-gesture-handler';

interface IConnectionItemProps {
    connectionDetails: any;
    getConnectionSubtitle: any;
    onConnectionPress: any;
}

const ConnectionItem: React.FunctionComponent<IConnectionItemProps> = ({
    connectionDetails,
    getConnectionSubtitle,
    onConnectionPress,
}) => {
    return (
        <ListItem
            onPress={() => onConnectionPress(connectionDetails)}
            bottomDivider
        >
            <Avatar
                source={{
                    uri: `https://robohash.org/${connectionDetails.id}?size=100x100`,
                }}
            />
            <ListItem.Content>
                <ListItem.Title>{connectionDetails.userName}</ListItem.Title>
                <ListItem.Subtitle>{getConnectionSubtitle(connectionDetails)}</ListItem.Subtitle>
            </ListItem.Content>
        </ListItem>
    );
};

export default ConnectionItem;
