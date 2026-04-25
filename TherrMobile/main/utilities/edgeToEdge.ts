import { NativeModules, Platform } from 'react-native';

interface EdgeToEdgeModule {
    enable: () => Promise<void>;
    disable: () => Promise<void>;
}

const EdgeToEdge: EdgeToEdgeModule | undefined = NativeModules.EdgeToEdge;

export const enableEdgeToEdge = (): Promise<void> => {
    if (Platform.OS !== 'android' || !EdgeToEdge) {
        return Promise.resolve();
    }
    return EdgeToEdge.enable().catch(() => {
        // Swallow errors; this is a cosmetic enhancement.
    });
};

export const disableEdgeToEdge = (): Promise<void> => {
    if (Platform.OS !== 'android' || !EdgeToEdge) {
        return Promise.resolve();
    }
    return EdgeToEdge.disable().catch(() => {
        // Swallow errors; this is a cosmetic enhancement.
    });
};
