import React from 'react';
import { View, Text } from 'react-native';
import 'react-native-gesture-handler';
import styles from '../../styles';
import ConnectionItem from './ConnectionItem';

interface IActiveConnectionsProps {
    getConnectionSubtitle: any;
    onConnectionPress: any;
    translate: any;
    userConnections: any;
    user: any;
}

const ActiveConnections: React.FunctionComponent<IActiveConnectionsProps> = ({
    getConnectionSubtitle,
    onConnectionPress,
    translate,
    userConnections,
}) => {
    return (
        <>
            <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>
                    {translate('components.activeConnections.title')}
                </Text>
                {
                    (!userConnections.activeConnections || !userConnections.activeConnections.length) &&
                    <>
                        <Text style={styles.sectionDescription}>
                            {translate(
                                'components.activeConnections.noActiveConnections'
                            )}
                        </Text>
                    </>
                }
            </View>
            <>
                {!!(userConnections.activeConnections && userConnections.activeConnections.length) &&
                    (userConnections.activeConnections.map((connection) => (
                        <ConnectionItem
                            key={connection.id}
                            connectionDetails={connection}
                            getConnectionSubtitle={getConnectionSubtitle}
                            onConnectionPress={onConnectionPress}
                        />
                    )))}
            </>
        </>
    );
};

export default ActiveConnections;
