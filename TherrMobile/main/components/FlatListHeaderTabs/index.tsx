import React from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { View } from 'react-native';
import 'react-native-gesture-handler';
import { INotificationsState } from 'therr-react/types';
import LocationActions from '../../redux/actions/LocationActions';
import { ILocationState } from '../../types/redux/location';
import buttonStyles from '../../styles/navigation/buttonMenu';

interface IFlatListHeaderTabsDispatchProps {
    updateGpsStatus: Function;
}

interface IStoreProps extends IFlatListHeaderTabsDispatchProps {
    location: ILocationState;
    notifications: INotificationsState;
}

// Regular component props
export interface IFlatListHeaderTabsProps extends IStoreProps {
    navigation: any;
    onButtonPress?: Function;
    tabName: string;
    translate: Function;
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
                style={buttonStyles.tabsContainer}
            >
                {this.props.children}
            </View>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(FlatListHeaderTabs);
