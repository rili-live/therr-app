/**
 * Celebratory sound + haptic feedback for achievement reward claims.
 *
 * The sounds are synthesized at runtime through the Web Audio graph exposed by
 * `react-native-audio-api` rather than shipped as bundled audio files. That
 * keeps the app bundle size unchanged, sidesteps per-platform encoding
 * differences (iOS/Android disagree on some mp3/m4a variants), and lets the
 * fanfare stay locked to the haptic ramp — both are driven from the same
 * millisecond offsets declared below.
 *
 * Every entry point here is best-effort. If the native audio module is not
 * linked yet (pods/gradle not rebuilt) or is unavailable (Jest, older device),
 * playback degrades to a silent no-op so a reward claim never fails because of
 * its celebration.
 */
import ReactNativeHapticFeedback, { HapticFeedbackTypes, HapticOptions } from 'react-native-haptic-feedback';
import type { AudioContext as RNAudioContext, GainNode as RNGainNode } from 'react-native-audio-api';

type OscillatorShape = 'sine' | 'triangle' | 'square' | 'sawtooth';

interface IToneOptions {
    /** Seconds on the AudioContext timeline at which the tone begins. */
    startAt: number;
    frequency: number;
    /** Ramp the pitch to this frequency across the tone's duration. */
    endFrequency?: number;
    durationSeconds: number;
    peakGain: number;
    shape?: OscillatorShape;
}

interface IHapticStep {
    atMs: number;
    type: HapticFeedbackTypes;
}

/**
 * `enableVibrateFallback` keeps the celebration perceptible on devices without a
 * taptic engine, while `ignoreAndroidSystemSettings: false` keeps it silent for
 * users who have turned system haptics off.
 */
const HAPTIC_OPTIONS: HapticOptions = {
    enableVibrateFallback: true,
    ignoreAndroidSystemSettings: false,
};

/** Exponential gain ramps cannot reach zero, so envelopes float just above it. */
const MIN_GAIN = 0.0001;
/** Extra time the oscillator runs past its envelope so the release is not clipped. */
const TAIL_SECONDS = 0.03;
/** Lead-in before the first note, so scheduling jitter never truncates the attack. */
const SCHEDULE_LEAD_SECONDS = 0.02;
/** How long the AudioContext lingers after the final note before it is torn down. */
const CONTEXT_IDLE_RELEASE_SECONDS = 2;

// Equal-tempered frequencies. Both cues sit in C major so overlapping playback
// (a fast claim followed immediately by the claim screen) stays consonant.
const NOTE_C5 = 523.25;
const NOTE_E5 = 659.25;
const NOTE_G5 = 783.99;
const NOTE_B5 = 987.77;
const NOTE_C6 = 1046.5;
const NOTE_E6 = 1318.51;
const NOTE_G6 = 1567.98;

/**
 * Haptic ramp for the full reward celebration. The offsets mirror the fanfare's
 * note onsets so each tap lands on a beat, building to the success notification.
 */
const CELEBRATION_HAPTIC_STEPS: IHapticStep[] = [
    { atMs: 0, type: HapticFeedbackTypes.impactLight },
    { atMs: 90, type: HapticFeedbackTypes.impactLight },
    { atMs: 180, type: HapticFeedbackTypes.impactMedium },
    { atMs: 270, type: HapticFeedbackTypes.impactHeavy },
    { atMs: 430, type: HapticFeedbackTypes.notificationSuccess },
];

let audioContext: RNAudioContext | null = null;
let isAudioUnavailable = false;
let releaseTimeoutId: ReturnType<typeof setTimeout> | null = null;

const triggerHaptic = (type: HapticFeedbackTypes) => {
    try {
        ReactNativeHapticFeedback.trigger(type, HAPTIC_OPTIONS);
    } catch {
        // Haptics are decorative — never let a missing motor break a claim.
    }
};

/**
 * Fires a timed series of haptic taps. Returns a canceller so a screen that
 * unmounts mid-celebration does not buzz the device afterwards.
 */
const runHapticSequence = (steps: IHapticStep[]): (() => void) => {
    const timeoutIds: ReturnType<typeof setTimeout>[] = [];

    steps.forEach(({ atMs, type }) => {
        if (atMs <= 0) {
            triggerHaptic(type);
            return;
        }

        timeoutIds.push(setTimeout(() => triggerHaptic(type), atMs));
    });

    return () => timeoutIds.forEach((timeoutId) => clearTimeout(timeoutId));
};

/**
 * Lazily builds (and caches) the AudioContext. Required lazily rather than
 * imported at module scope so that an unlinked native module cannot take down
 * app start or the Jest suite.
 */
const getAudioContext = (): RNAudioContext | null => {
    if (isAudioUnavailable) {
        return null;
    }

    if (audioContext) {
        return audioContext;
    }

    try {
        const AudioAPI = require('react-native-audio-api');

        // 'ambient' honors the iOS ringer switch and, combined with
        // 'mixWithOthers', never interrupts music the user already has playing.
        AudioAPI.AudioManager?.setAudioSessionOptions({
            iosCategory: 'ambient',
            iosMode: 'default',
            iosOptions: ['mixWithOthers'],
        });

        audioContext = new AudioAPI.AudioContext();

        return audioContext;
    } catch {
        isAudioUnavailable = true;

        return null;
    }
};

/**
 * Drops the cached context after a failure while scheduling a cue. Unlike a
 * failed `require`, these are recoverable (usually a context that closed
 * mid-schedule), so the next cue rebuilds rather than staying silent forever.
 */
const dropAudioContext = () => {
    audioContext = null;
};

/**
 * Tears the AudioContext down once the scheduled cue has finished, so a rarely
 * used celebration does not hold an audio session open for the whole session.
 */
const scheduleAudioRelease = (afterSeconds: number) => {
    if (releaseTimeoutId) {
        clearTimeout(releaseTimeoutId);
    }

    releaseTimeoutId = setTimeout(() => {
        releaseTimeoutId = null;
        const contextToClose = audioContext;
        audioContext = null;

        try {
            contextToClose?.close()?.catch(() => {});
        } catch {
            // Already closed or never fully opened — nothing to clean up.
        }
    }, (afterSeconds + CONTEXT_IDLE_RELEASE_SECONDS) * 1000);
};

/** Wires a single oscillator through its own gain envelope into `output`. */
const scheduleTone = (context: RNAudioContext, output: RNGainNode, options: IToneOptions) => {
    const {
        startAt,
        frequency,
        endFrequency,
        durationSeconds,
        peakGain,
        shape = 'sine',
    } = options;

    const oscillator = context.createOscillator();
    oscillator.type = shape;
    oscillator.frequency.setValueAtTime(frequency, startAt);

    if (endFrequency) {
        oscillator.frequency.exponentialRampToValueAtTime(endFrequency, startAt + durationSeconds);
    }

    // Percussive envelope: near-instant attack, exponential decay to silence.
    // The attack is clamped so very short blips still get a full rise and fall.
    const attackSeconds = Math.min(0.012, durationSeconds * 0.3);
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(MIN_GAIN, startAt);
    envelope.gain.exponentialRampToValueAtTime(peakGain, startAt + attackSeconds);
    envelope.gain.exponentialRampToValueAtTime(MIN_GAIN, startAt + durationSeconds);

    oscillator.connect(envelope);
    envelope.connect(output);

    oscillator.start(startAt);
    oscillator.stop(startAt + durationSeconds + TAIL_SECONDS);
};

/**
 * Builds a master gain node for one cue and returns it alongside the timeline
 * start point, or null when audio is unavailable.
 */
const beginCue = (masterGain: number): { context: RNAudioContext; output: RNGainNode; startAt: number } | null => {
    const context = getAudioContext();

    if (!context) {
        return null;
    }

    try {
        if (context.state === 'suspended') {
            context.resume()?.catch(() => {});
        }

        const output = context.createGain();
        const startAt = context.currentTime + SCHEDULE_LEAD_SECONDS;
        output.gain.setValueAtTime(masterGain, startAt);
        output.connect(context.destination);

        return { context, output, startAt };
    } catch {
        dropAudioContext();

        return null;
    }
};

/**
 * Short arcade-style "ka-ching" for the moment a claim is accepted by the API.
 * Two notes, square-wave lead for brightness with a sine layer underneath for
 * body. Roughly 400ms end to end.
 */
export const playCoinCollectSound = () => {
    const cue = beginCue(0.35);

    if (!cue) {
        return;
    }

    const { context, output, startAt } = cue;

    try {
        scheduleTone(context, output, {
            startAt, frequency: NOTE_B5, durationSeconds: 0.08, peakGain: 0.5, shape: 'square',
        });
        scheduleTone(context, output, {
            startAt, frequency: NOTE_B5, durationSeconds: 0.08, peakGain: 0.35, shape: 'sine',
        });
        scheduleTone(context, output, {
            startAt: startAt + 0.07, frequency: NOTE_E6, durationSeconds: 0.32, peakGain: 0.5, shape: 'square',
        });
        scheduleTone(context, output, {
            startAt: startAt + 0.07, frequency: NOTE_E6, durationSeconds: 0.32, peakGain: 0.35, shape: 'sine',
        });

        scheduleAudioRelease(0.4);
    } catch {
        dropAudioContext();
    }
};

/**
 * The full reward fanfare: a low impact thump for weight, an ascending C-major
 * arpeggio, a held major triad, then a scatter of high sparkles over the tail.
 * Roughly 1.1s end to end, timed to land with the confetti animation.
 */
export const playAchievementFanfareSound = () => {
    const cue = beginCue(0.32);

    if (!cue) {
        return;
    }

    const { context, output, startAt } = cue;

    try {
        // Sub thump — gives the celebration physical weight under the melody.
        scheduleTone(context, output, {
            startAt, frequency: 160, endFrequency: 55, durationSeconds: 0.35, peakGain: 0.7, shape: 'sine',
        });

        // Ascending arpeggio into a held triad.
        const arpeggio = [NOTE_C5, NOTE_E5, NOTE_G5];
        arpeggio.forEach((frequency, index) => {
            const noteStart = startAt + (index * 0.09);
            scheduleTone(context, output, {
                startAt: noteStart, frequency, durationSeconds: 0.2, peakGain: 0.45, shape: 'triangle',
            });
            scheduleTone(context, output, {
                startAt: noteStart, frequency, durationSeconds: 0.2, peakGain: 0.18, shape: 'square',
            });
        });

        const chordStart = startAt + 0.27;
        [NOTE_C6, NOTE_E6, NOTE_G6].forEach((frequency) => {
            scheduleTone(context, output, {
                startAt: chordStart, frequency, durationSeconds: 0.6, peakGain: 0.32, shape: 'triangle',
            });
        });

        // Sparkles — short high blips fanning out across the chord's tail.
        const sparkleCount = 6;
        for (let index = 0; index < sparkleCount; index += 1) {
            scheduleTone(context, output, {
                startAt: chordStart + 0.08 + (index * 0.085),
                frequency: 1800 + (index * 260),
                durationSeconds: 0.14,
                peakGain: 0.22,
                shape: 'sine',
            });
        }

        scheduleAudioRelease(1.1);
    } catch {
        dropAudioContext();
    }
};

/** Immediate tactile acknowledgement when the Claim button is pressed. */
export const triggerClaimPressFeedback = () => {
    triggerHaptic(HapticFeedbackTypes.impactLight);
};

/** Coin "ka-ching" plus a success tap the instant the claim is granted. */
export const triggerClaimSuccessFeedback = () => {
    triggerHaptic(HapticFeedbackTypes.notificationSuccess);
    playCoinCollectSound();
};

/** Buzz for a claim the server rejected. */
export const triggerClaimErrorFeedback = () => {
    triggerHaptic(HapticFeedbackTypes.notificationError);
};

/**
 * Full-screen celebration: fanfare plus the escalating haptic ramp.
 * Returns a canceller that stops any haptics still queued.
 */
export const triggerRewardCelebration = (): (() => void) => {
    playAchievementFanfareSound();

    return runHapticSequence(CELEBRATION_HAPTIC_STEPS);
};

/** Test seam — drops the cached context so each case starts from a clean slate. */
export const resetRewardFeedbackForTesting = () => {
    if (releaseTimeoutId) {
        clearTimeout(releaseTimeoutId);
        releaseTimeoutId = null;
    }

    audioContext = null;
    isAudioUnavailable = false;
};
