/**
 * Jest mock for `react-native-nitro-modules`.
 *
 * The peer dependency behind `react-native-iap` v14. It installs JSI bindings
 * at import time, which throws under Jest and takes down any suite that
 * transitively reaches it. Nothing in `main/**` imports it directly — it is
 * mocked so the transitive path is safe rather than because the app uses it.
 */

export const NitroModules = {
    createHybridObject: jest.fn(() => ({})),
    get box() {
        return jest.fn();
    },
};

export default { NitroModules };
