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

const Home = ({ navigation }) => {
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
                            <Text style={styles.sectionTitle}>Home Page</Text>
                            <Text style={styles.sectionDescription}>
                                Welcome to the homepage. This is a work in
                                progress...
                            </Text>
                            <Button
                                color="#1d5b69"
                                title="Go to Login page"
                                onPress={() =>
                                    navigation.navigate('Login', {
                                        name: 'Login',
                                    })
                                }
                            />
                        </View>
                    </View>
                </ScrollView>
            </SafeAreaView>
        </>
    );
};

export default Home;
