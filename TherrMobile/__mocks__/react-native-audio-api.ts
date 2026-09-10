/**
 * Jest mock for `react-native-audio-api`.
 *
 * The real package reaches for a JSI native module at import time, which is not
 * available under Jest. This mock stands in a minimal Web Audio graph and
 * records every scheduled oscillator so tests can assert on the synthesized
 * cues without needing an audio device.
 */

interface IScheduledOscillator {
    type: string;
    frequency: number;
    startAt: number;
    stopAt: number;
}

let scheduledOscillators: IScheduledOscillator[] = [];
let createdContextCount = 0;

class AudioParamMock {
    public value = 0;

    private readonly onSetValue?: (value: number, atTime: number) => void;

    constructor(initialValue = 0, onSetValue?: (value: number, atTime: number) => void) {
        this.value = initialValue;
        this.onSetValue = onSetValue;
    }

    setValueAtTime = jest.fn((value: number, atTime: number) => {
        this.value = value;
        this.onSetValue?.(value, atTime);
        return this;
    });

    linearRampToValueAtTime = jest.fn(() => this);

    exponentialRampToValueAtTime = jest.fn(() => this);

    setTargetAtTime = jest.fn(() => this);

    cancelScheduledValues = jest.fn(() => this);
}

class AudioNodeMock {
    connect = jest.fn((destination: unknown) => destination);

    disconnect = jest.fn();
}

class GainNodeMock extends AudioNodeMock {
    gain = new AudioParamMock(1);
}

class OscillatorNodeMock extends AudioNodeMock {
    type = 'sine';

    frequency = new AudioParamMock(440);

    detune = new AudioParamMock(0);

    private startAt = 0;

    start = jest.fn((when = 0) => {
        this.startAt = when;
    });

    stop = jest.fn((when = 0) => {
        scheduledOscillators.push({
            type: this.type,
            frequency: this.frequency.value,
            startAt: this.startAt,
            stopAt: when,
        });
    });
}

class AudioContextMock {
    currentTime = 0;

    state: 'running' | 'suspended' | 'closed' = 'running';

    sampleRate = 44100;

    destination = new AudioNodeMock();

    constructor() {
        createdContextCount += 1;
    }

    createGain = jest.fn(() => new GainNodeMock());

    createOscillator = jest.fn(() => new OscillatorNodeMock());

    resume = jest.fn(() => {
        this.state = 'running';
        return Promise.resolve();
    });

    suspend = jest.fn(() => Promise.resolve());

    close = jest.fn(() => {
        this.state = 'closed';
        return Promise.resolve();
    });
}

const AudioManager = {
    setAudioSessionOptions: jest.fn(),
    setAudioSessionActivity: jest.fn(() => Promise.resolve()),
    observeAudioInterruptions: jest.fn(),
};

/** Test helper — every oscillator scheduled since the last reset. */
export const __getScheduledOscillators = () => [...scheduledOscillators];

/** Test helper — how many AudioContexts have been constructed. */
export const __getCreatedContextCount = () => createdContextCount;

/** Test helper — clears recorded graph activity between cases. */
export const __resetAudioMock = () => {
    scheduledOscillators = [];
    createdContextCount = 0;
    AudioManager.setAudioSessionOptions.mockClear();
};

export { AudioContextMock as AudioContext, AudioManager, GainNodeMock as GainNode, OscillatorNodeMock as OscillatorNode };

export default {
    AudioContext: AudioContextMock,
    AudioManager,
    GainNode: GainNodeMock,
    OscillatorNode: OscillatorNodeMock,
};
