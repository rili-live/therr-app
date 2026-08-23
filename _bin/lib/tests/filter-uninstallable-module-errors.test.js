// Tests for the mobile tsc-baseline module filter.
//
// This filter sits inside a gate, which is the reason it needs tests: every bug in it is
// silent in the direction that matters. Excuse too much and a real "cannot find module" —
// a deleted dependency, a typo'd import — stops failing the baseline check and nobody
// notices, because the check still prints a cheerful green line. So the cases below are
// mostly about what the filter must NOT swallow.

const assert = require('assert');

const { filterSignatures } = require('../filter-uninstallable-module-errors');

const sig = (file, code, message) => `${file}\t${code}\t${message}`;
const cannotFind = (name) => `Cannot find module '${name}' or its corresponding type declarations.`;

// A licensed package: declared, but not installed here.
const declaredDependencies = new Set(['react-native-background-geolocation', 'react-native-maps']);
const installed = new Set(['react-native-maps']);
const isInstalled = (name) => installed.has(name);
const opts = { declaredDependencies, isInstalled };

// --- The case this exists for --------------------------------------------------------------

{
    const { kept, excused } = filterSignatures([
        sig('TherrMobile/main/components/Layout.tsx', 'TS2307', cannotFind('react-native-background-geolocation')),
    ], opts);

    assert.deepStrictEqual(kept, [], 'A declared-but-uninstalled package should be excused.');
    assert.deepStrictEqual(excused, ['react-native-background-geolocation']);
}

// --- Everything it must still gate on ------------------------------------------------------

{
    // Not declared anywhere: either a typo or an import of something nobody added.
    const { kept, excused } = filterSignatures([
        sig('TherrMobile/main/x.tsx', 'TS2307', cannotFind('never-declared-package')),
    ], opts);

    assert.strictEqual(kept.length, 1, 'An undeclared package must still fail the gate.');
    assert.deepStrictEqual(excused, []);
}

{
    // Relative imports are never dependencies, so a broken one is always a real error.
    const { kept } = filterSignatures([
        sig('TherrMobile/main/x.tsx', 'TS2307', cannotFind('./deleted-file')),
        sig('TherrMobile/main/y.tsx', 'TS2307', cannotFind('/abs/path')),
    ], opts);

    assert.strictEqual(kept.length, 2, 'Relative and absolute specifiers must still fail the gate.');
}

{
    // Declared AND installed — if tsc still cannot find it, something is genuinely wrong
    // (bad "types", missing d.ts, broken exports map) and that is worth failing on.
    const { kept } = filterSignatures([
        sig('TherrMobile/main/x.tsx', 'TS2307', cannotFind('react-native-maps')),
    ], opts);

    assert.strictEqual(kept.length, 1, 'An installed package that still will not resolve must fail the gate.');
}

{
    // Only TS2307 is in scope. A type error that happens to mention a package name is not.
    const { kept } = filterSignatures([
        sig('TherrMobile/main/x.tsx', 'TS2322', "Type 'react-native-background-geolocation' is not assignable."),
    ], opts);

    assert.strictEqual(kept.length, 1, 'Non-TS2307 codes must pass through untouched.');
}

{
    // A TS2307 whose message is not the "cannot find module" shape must pass through rather
    // than be silently dropped by a regex that failed to match.
    const { kept } = filterSignatures([
        sig('TherrMobile/main/x.tsx', 'TS2307', 'Some other resolution failure entirely.'),
    ], opts);

    assert.strictEqual(kept.length, 1, 'An unrecognized TS2307 message must pass through.');
}

// --- Mechanics ----------------------------------------------------------------------------

{
    // Blank lines (a trailing newline in the piped stream) must not survive as empty
    // signatures, which would inflate the count and never match the baseline.
    const { kept } = filterSignatures(['', sig('a.tsx', 'TS2322', 'x'), ''], opts);

    assert.deepStrictEqual(kept, [sig('a.tsx', 'TS2322', 'x')]);
}

{
    // Order is preserved: the baseline comparison relies on a sorted stream, and this filter
    // must not reshuffle it.
    const lines = [
        sig('a.tsx', 'TS1000', 'one'),
        sig('b.tsx', 'TS2307', cannotFind('react-native-background-geolocation')),
        sig('c.tsx', 'TS1000', 'three'),
    ];
    const { kept } = filterSignatures(lines, opts);

    assert.deepStrictEqual(kept, [lines[0], lines[2]]);
}

{
    // Each excused package is reported once even when many files import it.
    const { excused } = filterSignatures([
        sig('a.tsx', 'TS2307', cannotFind('react-native-background-geolocation')),
        sig('b.tsx', 'TS2307', cannotFind('react-native-background-geolocation')),
    ], opts);

    assert.deepStrictEqual(excused, ['react-native-background-geolocation']);
}

// eslint-disable-next-line no-console
console.log('filter-uninstallable-module-errors: all cases passed');
