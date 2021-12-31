import {
    // NativeModules,
    Platform,
    // NativeEventEmitter,
    DeviceEventEmitter,
} from 'react-native';

export default Platform.select({
    // https://callstack.com/blog/sending-events-to-javascript-from-your-native-module-in-react-native/
    // ios: new NativeEventEmitter(NativeModules.ModuleWithEmitter),
    android: DeviceEventEmitter,
});
