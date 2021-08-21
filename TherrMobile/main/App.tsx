import React from 'react';
import { Provider } from 'shared/react-redux';
import SplashScreen from 'react-native-splash-screen';
// import changeNavigationBarColor from 'react-native-navigation-bar-color';
import getStore from './getStore';
import initInterceptors from './interceptors';
import Layout from './components/Layout';
// import * as therrTheme from './styles/themes';
import { MIN_LOAD_TIMEOUT, MAX_LOAD_TIMEOUT } from './constants';
import EarthLoader from './components/Loaders/EarthLoader';

class App extends React.Component<any, any> {
    // TODO: Add typescript

    private store;
    private timeoutIdMin;
    private timeoutIdMax;

    constructor(props) {
        super(props);

        this.state = {
            isLoading: true,
            isMaxLoadTimeComplete: false,
            isMinLoadTimeComplete: false,
        };

        this.loadStorage();

        this.timeoutIdMin = setTimeout(() => {
            this.setState({
                isMinLoadTimeComplete: true,
            });
        }, MIN_LOAD_TIMEOUT + 200);
        this.timeoutIdMax = setTimeout(() => {
            this.setState({
                isMaxLoadTimeComplete: true,
            });
        }, MAX_LOAD_TIMEOUT + 200);
        // changeNavigationBarColor(therrTheme.colors.primary, false, true);
    }

    componentDidMount() {
        SplashScreen.hide();
    }

    componentWillUnmount() {
        clearTimeout(this.timeoutIdMin);
    }

    loadStorage = async () => {
        this.store = await getStore();
        initInterceptors(this.store);
        this.setState({
            isLoading: false,
        });
    };

    render() {
        const { isLoading, isMinLoadTimeComplete } = this.state;

        if (!isMinLoadTimeComplete || isLoading || !this.store) {
            return (
                <EarthLoader
                    visible={true}
                    speed={1.25}
                />
            );
        }

        return (
            <Provider store={this.store}>
                <Layout />
            </Provider>
        );
    }
}

export default App;
