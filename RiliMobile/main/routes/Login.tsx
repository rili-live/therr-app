import React from 'react';
import {
    SafeAreaView,
    ScrollView,
    View,
    Text,
    StatusBar,
    Button,
} from 'react-native';
import 'react-native-gesture-handler';
import styles from '../styles';
import { isAuthorized } from '../App';

const Login = ({ navigation }) => {
    return (
        <>
            <StatusBar barStyle="dark-content" />
            <SafeAreaView>
                <ScrollView
                    contentInsetAdjustmentBehavior="automatic"
                    style={styles.scrollView}
                >
                    <View style={styles.body}>
                        <View style={styles.sectionContainer}>
                            <Text style={styles.sectionTitle}>Login Page</Text>
                            <Text style={styles.sectionDescription}>
                                Welcome to the login page. This is also a work
                                in progress...
                            </Text>
                            {isAuthorized({
                                options: {
                                    access: {
                                        levels: [],
                                    },
                                },
                            }) && (
                                <Button
                                    color="#1d5b69"
                                    title="Go to Home page"
                                    onPress={() =>
                                        navigation.navigate('Home', {
                                            name: 'Home',
                                        })
                                    }
                                />
                            )}
                        </View>
                    </View>
                </ScrollView>
            </SafeAreaView>
        </>
    );
};

export default Login;
