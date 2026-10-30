// The Test Lab flag comes from a synchronous native constant on @react-native-firebase/app's utils
// module. A fresh registry per test lets each case choose the platform and the constant's value.
const loadModule = (
    os: 'android' | 'ios',
    utilsFactory: () => any,
): typeof import('../../main/utilities/analyticsCollection') => {
    jest.resetModules();
    jest.doMock('@react-native-firebase/app', () => ({ utils: utilsFactory }));
    require('react-native').Platform.OS = os;
    return require('../../main/utilities/analyticsCollection');
};

describe('analyticsCollection', () => {
    describe('isRunningInFirebaseTestLab', () => {
        it('is true on Android when Firebase Test Lab sets firebase.test.lab', () => {
            const { isRunningInFirebaseTestLab } = loadModule('android', () => ({ isRunningInTestLab: true }));

            expect(isRunningInFirebaseTestLab()).toBe(true);
        });

        it('is false on an ordinary Android device', () => {
            const { isRunningInFirebaseTestLab } = loadModule('android', () => ({ isRunningInTestLab: false }));

            expect(isRunningInFirebaseTestLab()).toBe(false);
        });

        it('is false on iOS without touching the native module', () => {
            const utils = jest.fn(() => ({ isRunningInTestLab: true }));
            const { isRunningInFirebaseTestLab } = loadModule('ios', utils);

            expect(isRunningInFirebaseTestLab()).toBe(false);
            expect(utils).not.toHaveBeenCalled();
        });

        it('treats a missing or throwing native module as "not Test Lab" rather than crashing app start', () => {
            const { isRunningInFirebaseTestLab } = loadModule('android', () => {
                throw new Error('RNFBUtilsModule is not linked');
            });

            expect(isRunningInFirebaseTestLab()).toBe(false);
        });

        it('only accepts a literal true', () => {
            const { isRunningInFirebaseTestLab } = loadModule('android', () => ({ isRunningInTestLab: 'true' }));

            expect(isRunningInFirebaseTestLab()).toBe(false);
        });
    });

    describe('shouldCollectAnalytics', () => {
        const { shouldCollectAnalytics } = loadModule('android', () => ({ isRunningInTestLab: false }));

        it('collects only for a release build outside Test Lab', () => {
            expect(shouldCollectAnalytics(false, false)).toBe(true);
            expect(shouldCollectAnalytics(true, false)).toBe(false);
            expect(shouldCollectAnalytics(false, true)).toBe(false);
            expect(shouldCollectAnalytics(true, true)).toBe(false);
        });
    });
});
