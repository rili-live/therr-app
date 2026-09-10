import Toast from 'react-native-toast-message';

const DURATION = { SHORT: 2000, DEFAULT: 3000, LONG: 4000 } as const;

interface IToastOptions {
    text1: string;
    text2?: string;
    duration?: number;
    onHide?: () => void;
    /**
     * Makes the toast actionable. `BaseToast`/`ErrorToast` already wrap their body in a
     * TouchableOpacity, so this only needs forwarding — but a toast that *does* something
     * should also say so in its text, since nothing about the default styling signals that
     * it is tappable.
     */
    onPress?: () => void;
    props?: Record<string, any>;
}

const showToast = {
    success: ({ text1, text2, duration = DURATION.DEFAULT, onHide, onPress, props }: IToastOptions) =>
        Toast.show({ type: text2 ? 'successBig' : 'success', text1, text2, visibilityTime: duration, onHide, onPress, props }),
    error: ({ text1, text2, duration = DURATION.DEFAULT, onHide, onPress, props }: IToastOptions) =>
        Toast.show({ type: text2 ? 'errorBig' : 'error', text1, text2, visibilityTime: duration, onHide, onPress, props }),
    warn: ({ text1, text2, duration = DURATION.DEFAULT, onHide, onPress, props }: IToastOptions) =>
        Toast.show({ type: text2 ? 'warnBig' : 'warn', text1, text2, visibilityTime: duration, onHide, onPress, props }),
    info: ({ text1, text2, duration = DURATION.DEFAULT, onHide, onPress, props }: IToastOptions) =>
        Toast.show({ type: 'info', text1, text2, visibilityTime: duration, onHide, onPress, props }),
    notify: ({ text1, text2, duration = DURATION.LONG, onHide, onPress, props }: IToastOptions) =>
        Toast.show({ type: 'notifyPublic', text1, text2, visibilityTime: duration, onHide, onPress, props }),
};

export { showToast, DURATION };
