import React from 'react';
import { Button } from 'react-native-elements';
import 'react-native-gesture-handler';
import { createIconSetFromIcoMoon } from 'react-native-vector-icons';
import therrIconConfig from '../assets/therr-icon-config.json';
import styles from '../styles';

const LogoIcon = createIconSetFromIcoMoon(
    therrIconConfig,
    'TherrFont',
    'TherrFont.ttf'
);

interface IHeaderMenuLeftDispatchProps {}

interface IStoreProps extends IHeaderMenuLeftDispatchProps {}

// Regular component props
export interface IHeaderMenuLeftProps extends IStoreProps {
    isAuthenticated: boolean;
    styleName: 'light' | 'dark' | 'beemo';
    navigation: any;
}

interface IHeaderMenuLeftState {}

class HeaderMenuLeft extends React.Component<
    IHeaderMenuLeftProps,
    IHeaderMenuLeftState
> {
    constructor(props) {
        super(props);

        this.state = {};
    }

    handlePress = () => {
        const { isAuthenticated, navigation } = this.props;
        if (isAuthenticated) {
            navigation.navigate('Home');
        } else {
            navigation.navigate('Login');
        }
    };

    render() {
        const { styleName } = this.props;
        let logoStyle = styles.logoIcon;
        if (styleName === 'light') {
            logoStyle = styles.logoIcon;
        }
        if (styleName === 'dark') {
            logoStyle = styles.logoIconDark;
        }
        if (styleName === 'beemo') {
            logoStyle = styles.logoIconBlack;
        }

        return (
            <Button
                type="clear"
                icon={
                    <LogoIcon
                        name="therr-logo"
                        size={28}
                        style={logoStyle}
                        onPress={this.handlePress}
                    />
                }
            />
        );
    }
}

export default HeaderMenuLeft;
