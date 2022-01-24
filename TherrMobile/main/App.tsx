import React from 'react';
import { Provider } from 'shared/react-redux';
import SplashScreen from 'react-native-bootsplash';
import { appleAuth } from '@invertase/react-native-apple-authentication';
// import changeNavigationBarColor from 'react-native-navigation-bar-color';
import getStore from './getStore';
import initInterceptors from './interceptors';
import Layout from './components/Layout';
// import { buildStyles } from './styles';

class App extends React.Component<any, any> {
    private authCredentialListener;
    private store;
    // private theme = buildStyles()''

    constructor(props) {
        super(props);

        this.state = {
            isLoading: true,
        };

        this.loadStorage();
        // changeNavigationBarColor(therrTheme.colors.primary, false, true);
    }

    componentDidMount() {
        if (appleAuth.isSupported) {
            this.authCredentialListener = appleAuth.onCredentialRevoked(async () => {
                // TODO: Logout user
                console.warn('Credential Revoked');
            });
        }
    }

    componentWillUnmount() {
        if (this.authCredentialListener) {
            this.authCredentialListener();
        }
    }

    loadStorage = async () => {
        this.store = await getStore();
        initInterceptors(this.store);

        this.setState({
            isLoading: false,
        }, () => SplashScreen.hide({ fade: true }));
    };

    render() {
        const { isLoading } = this.state;

        if (isLoading || !this.store) {
            return null;
        }

        return (
            <Provider store={this.store}>
                <Layout />
            </Provider>
        );
    }
}

export default App;
