import React from 'react';
import { Provider } from 'shared/react-redux';
import { Text } from 'react-native';
import getStore from './getStore';
import initInterceptors from './interceptors';
import Layout from './components/Layout';

class App extends React.Component<any, any> {
    constructor(props) {
        super(props);

        this.state = {
            isLoading: true,
        };

        this.loadStorage();
    }

    // TODO: Add typescript
    private store;

    loadStorage = async () => {
        this.store = await getStore();
        initInterceptors(this.store);
        this.setState({
            isLoading: false,
        });
    };

    render() {
        const { isLoading } = this.state;

        if (isLoading || !this.store) {
            return <Text>Loading...</Text>;
        }

        return (
            <Provider store={this.store}>
                <Layout />
            </Provider>
        );
    }
}

export default App;
