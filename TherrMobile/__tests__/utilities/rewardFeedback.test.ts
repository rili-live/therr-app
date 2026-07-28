// The audio and haptics packages are swapped for local mocks via `moduleNameMapper`
// in jest.config.js, so these relative imports reference the exact module instance
// that `rewardFeedback` receives at runtime.
import {
    __getCreatedContextCount,
    __getScheduledOscillators,
    __resetAudioMock,
    AudioManager,
} from '../../__mocks__/react-native-audio-api';
import ReactNativeHapticFeedback, { HapticFeedbackTypes } from '../../__mocks__/react-native-haptic-feedback';
import {
    playAchievementFanfareSound,
    playCoinCollectSound,
    resetRewardFeedbackForTesting,
    triggerClaimErrorFeedback,
    triggerClaimPressFeedback,
    triggerClaimSuccessFeedback,
    triggerRewardCelebration,
} from '../../main/utilities/rewardFeedback';

const mockedTrigger = ReactNativeHapticFeedback.trigger;

describe('rewardFeedback', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        mockedTrigger.mockClear();
        __resetAudioMock();
        resetRewardFeedbackForTesting();
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    describe('haptics', () => {
        it('taps lightly when the claim button is pressed', () => {
            triggerClaimPressFeedback();

            expect(mockedTrigger).toHaveBeenCalledTimes(1);
            expect(mockedTrigger.mock.calls[0][0]).toBe(HapticFeedbackTypes.impactLight);
        });

        it('buzzes an error pattern when a claim fails', () => {
            triggerClaimErrorFeedback();

            expect(mockedTrigger).toHaveBeenCalledWith(
                HapticFeedbackTypes.notificationError,
                expect.any(Object),
            );
        });

        it('respects the system haptics setting and falls back to vibration', () => {
            triggerClaimPressFeedback();

            expect(mockedTrigger.mock.calls[0][1]).toEqual({
                enableVibrateFallback: true,
                ignoreAndroidSystemSettings: false,
            });
        });

        it('escalates through the celebration ramp on a timeline', () => {
            triggerRewardCelebration();

            // Only the offset-zero tap fires synchronously.
            expect(mockedTrigger).toHaveBeenCalledTimes(1);

            jest.advanceTimersByTime(500);

            expect(mockedTrigger.mock.calls.map((call) => call[0])).toEqual([
                HapticFeedbackTypes.impactLight,
                HapticFeedbackTypes.impactLight,
                HapticFeedbackTypes.impactMedium,
                HapticFeedbackTypes.impactHeavy,
                HapticFeedbackTypes.notificationSuccess,
            ]);
        });

        it('stops queued taps once the celebration is cancelled', () => {
            const cancel = triggerRewardCelebration();

            cancel();
            jest.advanceTimersByTime(500);

            // Only the synchronous first tap got through.
            expect(mockedTrigger).toHaveBeenCalledTimes(1);
        });

        it('does not throw when the haptics module rejects the request', () => {
            mockedTrigger.mockImplementationOnce(() => {
                throw new Error('no taptic engine');
            });

            expect(() => triggerClaimPressFeedback()).not.toThrow();
        });
    });

    describe('sound', () => {
        it('configures an ambient, non-interrupting audio session', () => {
            playCoinCollectSound();

            expect(AudioManager.setAudioSessionOptions).toHaveBeenCalledWith({
                iosCategory: 'ambient',
                iosMode: 'default',
                iosOptions: ['mixWithOthers'],
            });
        });

        it('schedules the two-note coin cue', () => {
            playCoinCollectSound();

            const oscillators = __getScheduledOscillators();
            // Two notes, each doubled with a sine layer under the square lead.
            expect(oscillators).toHaveLength(4);
            expect(oscillators.every((osc) => osc.stopAt > osc.startAt)).toBe(true);

            const frequencies = [...new Set(oscillators.map((osc) => osc.frequency))].sort((a, b) => a - b);
            expect(frequencies).toEqual([987.77, 1318.51]);
        });

        it('schedules the fanfare as an ascending arpeggio into a held chord', () => {
            playAchievementFanfareSound();

            const oscillators = __getScheduledOscillators();
            // Sub thump + 3 arpeggio notes (doubled) + 3 chord notes + 6 sparkles.
            expect(oscillators).toHaveLength(16);

            const arpeggioOnsets = oscillators
                .filter((osc) => [523.25, 659.25, 783.99].includes(osc.frequency))
                .map((osc) => osc.startAt);
            expect(Math.min(...arpeggioOnsets)).toBeLessThan(Math.max(...arpeggioOnsets));
        });

        it('reuses a single audio context across cues, then releases it when idle', () => {
            playCoinCollectSound();
            playAchievementFanfareSound();

            expect(__getCreatedContextCount()).toBe(1);

            jest.advanceTimersByTime(10000);

            // A later cue builds a fresh context rather than reviving a closed one.
            playCoinCollectSound();
            expect(__getCreatedContextCount()).toBe(2);
        });

        it('pairs the coin cue with a success tap on a granted claim', () => {
            triggerClaimSuccessFeedback();

            expect(mockedTrigger).toHaveBeenCalledWith(
                HapticFeedbackTypes.notificationSuccess,
                expect.any(Object),
            );
            expect(__getScheduledOscillators().length).toBeGreaterThan(0);
        });
    });
});
