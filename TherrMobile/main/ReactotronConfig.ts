import Reactotron from 'reactotron-react-native';
import { Platform } from 'react-native';

declare global {
    interface Console {
        tron: typeof Reactotron;
    }
}

if (__DEV__) {
    const host = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';

    Reactotron
        .configure({ host, name: 'TherrMobile' })
        .useReactNative({
            networking: {
                ignoreUrls: /symbolicate|logs/
            }
        })
        .connect();

    // Make Reactotron available via console.tron for quick debugging
    console.tron = Reactotron;
}
