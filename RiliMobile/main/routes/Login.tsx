import React from 'react';
import { SafeAreaView, ScrollView, View, Text, StatusBar } from 'react-native';
import 'react-native-gesture-handler';
import styles from '../styles';

const Login = () => {
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
                        </View>
                    </View>
                </ScrollView>
            </SafeAreaView>
        </>
    );
};

export default Login;
