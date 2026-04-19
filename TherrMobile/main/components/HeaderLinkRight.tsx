import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { connect } from 'react-redux';
import { Button } from './BaseButton';
import 'react-native-gesture-handler';
import {
    AttachStep,
} from 'react-native-spotlight-tour';
import translator from '../utilities/translator';
import { ITherrThemeColors } from '../styles/themes';

const Title = ({
    buttonTitle,
    themeForms,
}) => (
    <AttachStep index={4}>
        <Text style={[
            themeForms.styles.buttonLinkHeader,
            localStyles.textCenter,
        ]}>{buttonTitle}</Text>
    </AttachStep>
);

export interface IHeaderMenuRightProps {
    user: any;
    navigation: any;
    styleName: 'light' | 'dark' | 'accent';
    themeForms: {
        colors: ITherrThemeColors;
        styles: any;
    };
}

const mapStateToProps = (state: any) => ({ user: state.user });

const HeaderLinkRight = ({
    user,
    navigation,
    themeForms,
}: IHeaderMenuRightProps) => {
    const translate = (key: string, params?: any) => translator(user?.settings?.locale || 'en-us', key, params);

    const navState = navigation.getState();
    const currentScreen = navState.routes[navState.routes.length - 1]?.name;
    const navScreenName = currentScreen === 'Login' ? 'Register' : 'Login';
    const buttonTitle = currentScreen === 'Login'
        ? translate('components.headerLinkRight.signUp')
        : translate('components.headerLinkRight.signIn');

    return (
        <Button
            title={<Title buttonTitle={buttonTitle} themeForms={themeForms} />}
            onPress={() => navigation.navigate(navScreenName)}
            type="clear"
            titleStyle={[themeForms.styles.buttonLinkHeader]}
            buttonStyle={themeForms.styles.buttonLinkHeaderContainer}
        />
    );
};

const localStyles = StyleSheet.create({
    textCenter: {
        textAlign: 'center',
    },
});

export default connect(mapStateToProps, null)(HeaderLinkRight);
