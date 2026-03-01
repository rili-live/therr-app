import Toast from 'react-native-toast-message';

const DURATION = { SHORT: 2000, DEFAULT: 3000, LONG: 4000 } as const;

interface IToastOptions {
    text1: string;
    text2?: string;
    duration?: number;
    onHide?: () => void;
    props?: Record<string, any>;
}

const showToast = {
    success: ({ text1, text2, duration = DURATION.DEFAULT, onHide, props }: IToastOptions) =>
        Toast.show({ type: text2 ? 'successBig' : 'success', text1, text2, visibilityTime: duration, onHide, props }),
    error: ({ text1, text2, duration = DURATION.DEFAULT, onHide, props }: IToastOptions) =>
        Toast.show({ type: text2 ? 'errorBig' : 'error', text1, text2, visibilityTime: duration, onHide, props }),
    warn: ({ text1, text2, duration = DURATION.DEFAULT, onHide, props }: IToastOptions) =>
        Toast.show({ type: text2 ? 'warnBig' : 'warn', text1, text2, visibilityTime: duration, onHide, props }),
    info: ({ text1, text2, duration = DURATION.DEFAULT, onHide, props }: IToastOptions) =>
        Toast.show({ type: 'info', text1, text2, visibilityTime: duration, onHide, props }),
    notify: ({ text1, text2, duration = DURATION.LONG, onHide, props }: IToastOptions) =>
        Toast.show({ type: 'notifyPublic', text1, text2, visibilityTime: duration, onHide, props }),
};

export { showToast, DURATION };
