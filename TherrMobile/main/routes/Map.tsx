import React from 'react';
import { StatusBar } from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { IUserState } from 'therr-react/types';
import UsersActions from '../redux/actions/UsersActions';

interface IMapDispatchProps {
    login: Function;
    logout: Function;
}

interface IStoreProps extends IMapDispatchProps {
    user: IUserState;
}

// Regular component props
export interface IMapProps extends IStoreProps {
    navigation: any;
}

interface IMapState {}

const mapStateToProps = (state: any) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) =>
    bindActionCreators(
        {
            login: UsersActions.login,
            logout: UsersActions.logout,
        },
        dispatch
    );

class Map extends React.Component<IMapProps, IMapState> {
    constructor(props) {
        super(props);

        this.state = {};
    }

    goToHome = () => {
        const { navigation } = this.props;

        navigation.navigate('Home');
    };

    render() {
        return (
            <>
                <StatusBar barStyle="dark-content" />
                <MapView
                    provider={PROVIDER_GOOGLE}
                    style={{ flex: 1 }}
                    region={{
                        latitude: 32.8102631,
                        longitude: -96.4683143,
                        latitudeDelta: 0.0922,
                        longitudeDelta: 0.0421,
                    }}
                    showsUserLocation={true}
                />
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(Map);
