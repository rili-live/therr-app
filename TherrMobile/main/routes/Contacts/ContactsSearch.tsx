import React from 'react';
import { View, Text } from 'react-native';
import 'react-native-gesture-handler';
import styles from '../../styles';
import ConnectionItem from '../ActiveConnections/ConnectionItem';

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
}) => {
    return (
        <>
            <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>
                    {translate('components.contactsSearch.title')}
                </Text>
                {
                    (!userConnections.connections || !userConnections.connections.length) &&
                    <>
                        <Text style={styles.sectionDescription}>
                            {translate('components.contactsSearch.noContactsFound')}
                        </Text>
                    </>
                }
            </View>
            <>
                {!!(userConnections.connections && userConnections.connections.length) && (
                    userConnections.connections.map((connection) => {
                        const connectionDetails = getConnectionDetails(connection);
                        return (
                            <ConnectionItem
                                key={connectionDetails.id}
                                connectionDetails={connectionDetails}
                                getConnectionSubtitle={getConnectionSubtitle}
                                onConnectionPress={onConnectionPress}
                            />
                        );
                    })
                )}
            </>
        </>
    );
};

export default ContactsSearch;
