import React from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { View } from 'react-native';
import 'react-native-gesture-handler';
import { INotificationsState } from 'therr-react/types';
import LocationActions from '../../redux/actions/LocationActions';
import { ILocationState } from '../../types/redux/location';
import { buttonMenuHeight, buttonMenuHeightCompact } from '../../styles/navigation/buttonMenu';
import { ITherrThemeColors } from '../../styles/themes';

interface IButtonMenuDispatchProps {
    updateGpsStatus: Function;
}

interface IStoreProps extends IButtonMenuDispatchProps {
    location: ILocationState;
    notifications: INotificationsState;
}

// Regular component props
export interface IButtonMenuProps extends IStoreProps {
    activeRoute?: string;
    children?: any;
    navigation: any;
    onActionButtonPress?: Function;
    onNearbyPress?: Function;
    isAbsolute?: Boolean;
    isCompact?: Boolean;
    onButtonPress?: Function;
    translate: Function;
    user: any;
    themeMenu: {
        colors: ITherrThemeColors;
        styles: any;
    },
    themeName?: string;
}

interface IButtonMenuState {}

export const mapStateToProps = (state: any) => ({
    location: state.location,
    notifications: state.notifications,
});

export const mapDispatchToProps = (dispatch: any) =>
    bindActionCreators(
        {
            updateGpsStatus: LocationActions.updateGpsStatus,
        },
        dispatch
    );

export class ButtonMenu extends React.Component<IButtonMenuProps, IButtonMenuState> {
    constructor(props) {
        super(props);

        this.state = {};
    }

    navTo = (routeName) => {
        const { navigation } = this.props;

        navigation.navigate(routeName);
    };

    getActiveRoute = () => {
        const { activeRoute } = this.props;
        if (activeRoute) {
            return activeRoute;
        }

        return this.getCurrentScreen();
    };

    /**
     * TODO: This seems to only get the previous state...
     */
    getCurrentScreen = () => {
        const navState = this.props.navigation.getState();

        return (
            navState.routes[navState.routes.length - 1] &&
            navState.routes[navState.routes.length - 1].name
        );
    };

    render() {
        const { isAbsolute, isCompact, themeMenu } = this.props;
        const overrideStyles: any = {};
        if (!isAbsolute) {
            overrideStyles.position = 'relative';
        }
        const containerHeight = isCompact ? buttonMenuHeightCompact : buttonMenuHeight;

        return (
            <View style={[themeMenu.styles.container, overrideStyles, { height: containerHeight }]}>
                <View style={themeMenu.styles.containerInner}>
                    {this.props.children}
                </View>
            </View>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(ButtonMenu);
