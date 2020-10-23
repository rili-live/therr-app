import React from 'react';
import { View, Text } from 'react-native';
import { ListItem } from 'react-native-elements';
import 'react-native-gesture-handler';
import styles from '../styles';

interface IContactsSearchProps {
    getConnectionDetails: any;
    getConnectionSubtitle: any;
    onConnectionPress: any;
    translate: any;
    userConnections: any;
    user: any;
}

const ContactsSearch: React.FunctionComponent<IContactsSearchProps> = ({
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
                {translate('components.contactsSearch.title')}
            </Text>
            {userConnections.connections &&
            userConnections.connections.length ? (
                    userConnections.connections.map((connection) => (
                        <ListItem
                            key={connection.id}
                            leftAvatar={{
                                source: {
                                    uri: `https://robohash.org/${
                                        connection.acceptingUserId ===
                                        user.details && user.details.id
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
                        {translate('components.contactsSearch.noContactsFound')}
                    </Text>
                )}
        </View>
    );
};

export default ContactsSearch;
