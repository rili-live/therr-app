import React from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { View } from 'react-native';
import 'react-native-gesture-handler';
import { INotificationsState } from 'therr-react/types';
import LocationActions from '../../redux/actions/LocationActions';
import { ILocationState } from '../../types/redux/location';

interface IFlatListHeaderTabsDispatchProps {
    updateGpsStatus: Function;
}

interface IStoreProps extends IFlatListHeaderTabsDispatchProps {
    location: ILocationState;
    notifications: INotificationsState;
}

// Regular component props
export interface IFlatListHeaderTabsProps extends IStoreProps {
    containerStyles: any;
    navigation: any;
    onButtonPress?: Function;
    tabName: string;
    translate: Function;
    themeMenu: {
        styles: any;
    };
}

interface IFlatListHeaderTabsState {
    activeTab: string;
}

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

export class FlatListHeaderTabs extends React.Component<IFlatListHeaderTabsProps, IFlatListHeaderTabsState> {
    constructor(props) {
        super(props);

        this.state = {
            activeTab: '',
        };
    }

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
        return (
            <View
                style={this.props.containerStyles}
            >
                {this.props.children}
            </View>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(FlatListHeaderTabs);
