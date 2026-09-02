// Tests for the VERSIONS.txt per-service ledger.
//
// This file is the deploy's answer to "what version should each service be
// running", so every bug in it is silent in the expensive direction: a wrong or
// missing row does not fail anything, it deploys the wrong image and reports
// success. The cases below are mostly about the ways the single-SHA file it
// replaces used to lose track of a service.

const assert = require('assert');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const LEDGER_LIB = path.join(REPO_ROOT, '_bin', 'lib', 'versions-ledger.sh');

// Runs a bash snippet with the ledger sourced, and returns its stdout.
const bash = (snippet) => execFileSync('bash', ['-c', `source "${LEDGER_LIB}"\n${snippet}`], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
}).trim();

const withTempFile = (contents, fn) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'versions-ledger-'));
    const file = path.join(dir, 'VERSIONS.txt');

    if (contents !== null) {
        fs.writeFileSync(file, contents);
    }

    try {
        return fn(file);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
};

// --- The case this exists for ----------------------------------------------------------------

{
    // Two merges to stage before a promotion to main. The old file held one SHA, so
    // whichever service published second spoke for both, and the deploy then pulled a
    // tag that was never built for the first one.
    const ledger = withTempFile('', (file) => {
        bash(`
            ledger_load "${file}"
            LEDGER_LAST_PUBLISHED=aaaaaaa
            ledger_set users-service aaaaaaa
            ledger_write "${file}"

            ledger_load "${file}"
            LEDGER_LAST_PUBLISHED=bbbbbbb
            ledger_set maps-service bbbbbbb
            ledger_write "${file}"
        `);
        return fs.readFileSync(file, 'utf8');
    });

    assert.match(ledger, /^PUBLISHED_USERS_SERVICE=aaaaaaa$/m, 'The second publish must not overwrite the first service\'s recorded SHA.');
    assert.match(ledger, /^PUBLISHED_MAPS_SERVICE=bbbbbbb$/m);
    assert.match(ledger, /^LAST_PUBLISHED_GIT_SHA=bbbbbbb$/m, 'LAST_PUBLISHED_GIT_SHA still tracks the most recent publish, as a watermark.');
}

{
    // ...and each service resolves to the build that actually contains it.
    const resolved = withTempFile(
        'LAST_PUBLISHED_GIT_SHA=bbbbbbb\nPUBLISHED_MAPS_SERVICE=bbbbbbb\nPUBLISHED_USERS_SERVICE=aaaaaaa\n',
        (file) => bash(`ledger_load "${file}"; echo "$(ledger_resolve users-service) $(ledger_resolve maps-service)"`),
    );

    assert.strictEqual(resolved, 'aaaaaaa bbbbbbb');
}

// --- A row is a promise; the watermark is not --------------------------------------------------

{
    // ledger_resolve must NOT fall back to LAST_PUBLISHED_GIT_SHA. That watermark means
    // "most recent stage publish, any service", but publish.sh is incremental and bumps
    // it even when it pushed one image — so resolving through it points every unrowed
    // service at a tag that was never built for it, which is `missing-image`, which is
    // blocking. That deadlocked production for three promotions.
    const resolved = withTempFile('LAST_PUBLISHED_GIT_SHA=ccccccc\n', (file) => bash(`
        ledger_load "${file}"
        echo "[$(ledger_resolve users-service)][$(ledger_resolve client-web)]"
    `));

    assert.strictEqual(resolved, '[][]', 'A service with no row has no desired tag — guessing one is the bug.');
}

{
    // The watermark is still parsed and still written (publish.sh sets it, and it is the
    // file's backwards-compatible first line) — it just resolves nothing on its own.
    const kept = withTempFile('LAST_PUBLISHED_GIT_SHA=ccccccc\nPUBLISHED_MAPS_SERVICE=bbbbbbb\n', (file) => bash(`
        ledger_load "${file}"
        echo "[$LEDGER_LAST_PUBLISHED][$(ledger_resolve maps-service)][$(ledger_resolve users-service)]"
    `));

    assert.strictEqual(kept, '[ccccccc][bbbbbbb][]');
}

{
    // A service with its own row must NOT fall back, even though a newer file-wide
    // SHA exists — falling back is exactly the bug.
    const resolved = withTempFile(
        'LAST_PUBLISHED_GIT_SHA=ddddddd\nPUBLISHED_USERS_SERVICE=aaaaaaa\n',
        (file) => bash(`ledger_load "${file}"; ledger_resolve users-service`),
    );

    assert.strictEqual(resolved, 'aaaaaaa');
}

{
    // An empty or absent file resolves to nothing rather than to a partial string.
    // deploy.sh reads the empty result as "unpublished" and refuses to guess.
    assert.strictEqual(withTempFile('', (file) => bash(`ledger_load "${file}"; ledger_resolve users-service`)), '');
    assert.strictEqual(withTempFile(null, (file) => bash(`ledger_load "${file}"; ledger_resolve users-service`)), '');
}

// --- Parsing, and what the old `export $(cat VERSIONS.txt)` did with it -----------------------

{
    // CRLF endings produced a SHA with a trailing carriage return, which then failed
    // every `docker pull` for a reason invisible in the log.
    const resolved = withTempFile('LAST_PUBLISHED_GIT_SHA=eeeeeee\r\nPUBLISHED_MAPS_SERVICE=fffffff\r\n', (file) => bash(`
        ledger_load "${file}"
        echo "[$(ledger_resolve maps-service)]"
    `));

    assert.strictEqual(resolved, '[fffffff]');
}

{
    // Comments and blank lines are data to `export`, not to a line parser.
    const resolved = withTempFile('# written by publish.sh\n\nPUBLISHED_USERS_SERVICE=1234567  # stage\n', (file) => bash(`
        ledger_load "${file}"
        echo "[$(ledger_resolve users-service)]"
    `));

    assert.strictEqual(resolved, '[1234567]');
}

{
    // A row with no value is not a row. Recording an empty SHA would make the deploy
    // try to pull "therrapp/users-service-stage:". It resolves to nothing — not to the
    // file-wide watermark, which is not this service's tag.
    const resolved = withTempFile('PUBLISHED_USERS_SERVICE=\nLAST_PUBLISHED_GIT_SHA=9999999\n', (file) => bash(`
        ledger_load "${file}"
        echo "[$(ledger_resolve users-service)]"
    `));

    assert.strictEqual(resolved, '[]');
}

{
    // Unrelated keys are ignored rather than becoming phantom services.
    const written = withTempFile('SOME_OTHER_SETTING=true\nPUBLISHED_USERS_SERVICE=1234567\n', (file) => {
        bash(`ledger_load "${file}"; ledger_write "${file}"`);
        return fs.readFileSync(file, 'utf8');
    });

    assert.strictEqual(written, 'PUBLISHED_USERS_SERVICE=1234567\n');
}

// --- Round-tripping and merge behaviour ------------------------------------------------------

{
    // Rows are sorted so the file merges by line: two services published on different
    // branches land on different lines instead of colliding on one.
    const written = withTempFile('', (file) => {
        bash(`
            ledger_load "${file}"
            LEDGER_LAST_PUBLISHED=zzzzzzz
            ledger_set websocket-service 7777777
            ledger_set api-gateway 5555555
            ledger_set client-web 6666666
            ledger_write "${file}"
        `);
        return fs.readFileSync(file, 'utf8');
    });

    assert.strictEqual(written, [
        'LAST_PUBLISHED_GIT_SHA=zzzzzzz',
        'PUBLISHED_API_GATEWAY=5555555',
        'PUBLISHED_CLIENT_WEB=6666666',
        'PUBLISHED_WEBSOCKET_SERVICE=7777777',
        '',
    ].join('\n'));
}

{
    // Key <-> variable-name mapping must round-trip, or a service silently loses its
    // row on the next load.
    const roundTripped = bash(`
        for KEY in client-web api-gateway push-notifications-service users-service; do
            echo -n "$(ledger_key_from_var "$(ledger_var_from_key "$KEY")") "
        done
    `);

    assert.strictEqual(roundTripped.trim(), 'client-web api-gateway push-notifications-service users-service');
}

{
    // Every key in the real registry must survive that round trip — this is the check
    // that fails when someone adds a service whose key contains an underscore.
    const registryLib = path.join(REPO_ROOT, '_bin', 'lib', 'service-registry.sh');
    const mismatches = execFileSync('bash', ['-c', `
        source "${registryLib}"
        source "${LEDGER_LIB}"
        for KEY in $(service_keys); do
            ROUND_TRIPPED="$(ledger_key_from_var "$(ledger_var_from_key "$KEY")")"
            [ "$ROUND_TRIPPED" = "$KEY" ] || echo "$KEY -> $ROUND_TRIPPED"
        done
    `], { cwd: REPO_ROOT, encoding: 'utf8' }).trim();

    assert.strictEqual(mismatches, '', 'Registry keys must round-trip through the ledger variable name.');
}

console.log('versions-ledger: all assertions passed');
