import React from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { View } from 'react-native';
import 'react-native-gesture-handler';
import { INotificationsState } from 'therr-react/types';
import LocationActions from '../../redux/actions/LocationActions';
import { ILocationState } from '../../types/redux/location';
import { buttonMenu } from '../../styles/navigation';
import { buttonMenuHeight, buttonMenuHeightCompact } from '../../styles/navigation/buttonMenu';

interface IButtonMenuDispatchProps {
    updateGpsStatus: Function;
}

interface IStoreProps extends IButtonMenuDispatchProps {
    location: ILocationState;
    notifications: INotificationsState;
}

// Regular component props
export interface IButtonMenuProps extends IStoreProps {
    navigation: any;
    onActionButtonPress?: Function;
    isAbsolute?: Boolean;
    isCompact?: Boolean;
    onButtonPress?: Function;
    translate: Function;
    user: any;
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

    getCurrentScreen = () => {
        const navState = this.props.navigation.dangerouslyGetState();

        return (
            navState.routes[navState.routes.length - 1] &&
            navState.routes[navState.routes.length - 1].name
        );
    };

    render() {
        const { isAbsolute, isCompact } = this.props;
        const overrideStyles: any = {};
        if (!isAbsolute) {
            overrideStyles.position = 'relative';
        }
        const containerHeight = isCompact ? buttonMenuHeightCompact : buttonMenuHeight;

        return (
            <View style={[buttonMenu.container, overrideStyles, { height: containerHeight }]}>
                <View style={buttonMenu.containerInner}>
                    {this.props.children}
                </View>
            </View>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(ButtonMenu);
