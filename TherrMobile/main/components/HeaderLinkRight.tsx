import React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { Button } from 'react-native-elements';
import 'react-native-gesture-handler';
import translator from '../services/translator';
import { ITherrThemeColors } from '../styles/themes';

interface IHeaderMenuRightDispatchProps {
}

interface IStoreProps extends IHeaderMenuRightDispatchProps {
}

// Regular component props
export interface IHeaderMenuRightProps extends IStoreProps {
    navigation: any;
    styleName: 'light' | 'dark' | 'accent';
    themeForms: {
        colors: ITherrThemeColors;
        styles: any;
    };
}

interface IHeaderMenuRightState {
    isModalVisible: boolean;
    isPointsInfoModalVisible: boolean;
}

const mapStateToProps = () => ({});

const mapDispatchToProps = (dispatch: any) =>
    bindActionCreators(
        {},
        dispatch
    );

class HeaderMenuRight extends React.Component<
    IHeaderMenuRightProps,
    IHeaderMenuRightState
> {
    private timeoutId: any;

    private translate: Function;

    constructor(props) {
        super(props);

        this.state = {
            isModalVisible: false,
            isPointsInfoModalVisible: false,
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentWillUnmount = () => {
        clearTimeout(this.timeoutId);
    };

    toggleOverlay = (shouldClose?: boolean) => {
        const { isModalVisible } = this.state;

        return new Promise((resolve) => {
            this.setState({
                isModalVisible: shouldClose ? false : !isModalVisible,
            }, () => {
                resolve(null);
            });
        });
    };

    navTo = (routeName) => {
        const { navigation } = this.props;

        navigation.navigate(routeName);
    };

    getCurrentScreen = () => {
        const navState = this.props.navigation.getState();

        return (
            navState.routes[navState.routes.length - 1] &&
            navState.routes[navState.routes.length - 1].name
        );
    };

    render() {
        const {
            themeForms,
        } = this.props;

        const currentScreen = this.getCurrentScreen();
        const navScreenName = currentScreen === 'Login' ? 'Register' : 'Login';
        const buttonTitle = currentScreen === 'Login'
            ? this.translate('components.headerLinkRight.signUp')
            : this.translate('components.headerLinkRight.signIn');

        return (
            <Button
                title={buttonTitle}
                onPress={() => this.navTo(navScreenName)}
                type="clear"
                titleStyle={themeForms.styles.buttonLinkHeader}
                buttonStyle={themeForms.styles.buttonLinkHeaderContainer}
            />
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(HeaderMenuRight);
