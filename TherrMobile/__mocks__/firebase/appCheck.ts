// Native module; unavailable under Jest. Tests override `getToken` to exercise the token path.
export const initializeAppCheck = jest.fn(() => Promise.resolve({}));
export const getToken = jest.fn(() => Promise.resolve({ token: 'mockAppCheckToken' }));

export class ReactNativeFirebaseAppCheckProvider {
    configure = jest.fn();
}
