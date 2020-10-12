import React from 'react';
import { Provider } from 'shared/react-redux';
import AnimatedLoader from 'react-native-animated-loader';
import getStore from './getStore';
import initInterceptors from './interceptors';
import Layout from './components/Layout';
import { loaderStyles } from './styles';
import { MIN_LOAD_TIMEOUT } from './constants';

const earthLoader = require('./assets/earth-loader.json');

class App extends React.Component<any, any> {
    constructor(props) {
        super(props);

        this.state = {
            isLoading: true,
            isMinLoadTimeComplete: false,
        };

        this.loadStorage();

        this.timeoutId = setTimeout(() => {
            this.setState({
                isMinLoadTimeComplete: true,
            });
        }, MIN_LOAD_TIMEOUT + 200);
    }

    componentWillUnmount() {
        clearTimeout(this.timeoutId);
    }

    // TODO: Add typescript
    private store;
    private timeoutId;

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
                <AnimatedLoader
                    visible={true}
                    overlayColor="rgba(255,255,255,0.75)"
                    source={earthLoader}
                    animationStyle={loaderStyles.lottie}
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
