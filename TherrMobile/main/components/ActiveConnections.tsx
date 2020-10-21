import React from 'react';
import { View, Text } from 'react-native';
import { ListItem } from 'react-native-elements';
import 'react-native-gesture-handler';
import styles from '../styles';

interface IActiveConnectionsProps {
    getConnectionDetails: any;
    getConnectionSubtitle: any;
    onConnectionPress: any;
    translate: any;
    userConnections: any;
    user: any;
}

const ActiveConnections: React.FunctionComponent<IActiveConnectionsProps> = ({
    getConnectionDetails,
    getConnectionSubtitle,
    onConnectionPress,
    translate,
    userConnections,
    user,
}) => {
    return (
        <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>
                {translate('components.activeConnections.title')}
            </Text>
            {userConnections.activeConnections &&
                userConnections.activeConnections.length ? (
                    userConnections.activeConnections.map((connection) => (
                        <ListItem
                            key={connection.id}
                            leftAvatar={{
                                source: {
                                    uri: `https://robohash.org/${
                                        connection.acceptingUserId === user.details && user.details.id
                                            ? connection.requestingUserId
                                            : connection.acceptingUserId
                                    }?size=100x100`,
                                },
                            }}
                            onPress={() => onConnectionPress(connection)}
                            title={getConnectionDetails(connection).userName}
                            subtitle={getConnectionSubtitle(connection)}
                            bottomDivider
                        />
                    ))
                ) : (
                    <Text style={styles.sectionDescription}>
                        {translate('pages.userProfile.noActiveConnections')}
                    </Text>
                )}
        </View>
    );
};

export default ActiveConnections;
