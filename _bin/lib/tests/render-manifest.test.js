// Tests for rendering the image tag into a Deployment manifest before apply.
//
// The failure this guards against was silent: `kubectl apply` reset every
// Deployment's image to `:latest`, and the SHA only came back when a `set image`
// happened to follow. So the cases that matter are that the rendered manifest holds
// exactly the intended reference, that nothing else in the file moves, and that a
// manifest the substitution cannot be applied to unambiguously is refused rather
// than applied as-is.

const assert = require('assert');
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const RENDER_LIB = path.join(REPO_ROOT, '_bin', 'lib', 'render-manifest.sh');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'render-manifest-'));
const write = (name, text) => {
    const file = path.join(tmp, name);
    fs.writeFileSync(file, text);
    return file;
};

const render = (manifest, imageName, imageRef) => {
    const out = path.join(tmp, `out-${Math.random().toString(36).slice(2)}.yaml`);
    const result = spawnSync('bash', ['-c', `source "${RENDER_LIB}"; render_deployment_manifest "$@"`, '--', manifest, imageName, imageRef, out], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
    });
    return {
        status: result.status, stderr: result.stderr, out, text: fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : null,
    };
};

const MANIFEST = [
    'apiVersion: apps/v1',
    'kind: Deployment',
    'spec:',
    '  template:',
    '    spec:',
    '      containers:',
    '      - name: server-users',
    '        image: therrapp/users-service:latest',
    '        imagePullPolicy: IfNotPresent',
    '      - name: cloud-sql-proxy',
    '        image: gcr.io/cloud-sql-connectors/cloud-sql-proxy:2.14.3',
    '',
].join('\n');

// --- The ordinary path -----------------------------------------------------------------------

{
    const manifest = write('users.yaml', MANIFEST);
    const result = render(manifest, 'users-service', 'therrapp/users-service:6d03aa78ce2a');

    assert.strictEqual(result.status, 0, result.stderr);
    assert.strictEqual(
        result.text,
        MANIFEST.replace('therrapp/users-service:latest', 'therrapp/users-service:6d03aa78ce2a'),
        'only the therrapp image line changes; indentation, the sidecar and everything else are byte-identical',
    );
    assert.ok(!result.text.includes(':latest'), 'no :latest survives rendering');

    // A stage deploy renders the suffixed repository, not just a different tag.
    const staged = render(manifest, 'users-service', 'therrapp/users-service-stage:6d03aa78ce2a');
    assert.strictEqual(staged.status, 0, staged.stderr);
    assert.ok(staged.text.includes('        image: therrapp/users-service-stage:6d03aa78ce2a\n'));

    // The source manifest is never modified.
    assert.strictEqual(fs.readFileSync(manifest, 'utf8'), MANIFEST);
}

// --- What must be refused ---------------------------------------------------------------------

{
    // A manifest that does not carry the expected `:latest` line — a sidecar-only
    // file, a renamed image, or a tag someone hand-pinned — cannot be rendered. Applying
    // it as-is would deploy whatever it says, so it fails instead.
    const redis = write('redis.yaml', 'spec:\n  template:\n    spec:\n      containers:\n      - name: redis\n        image: redis:7\n');
    const missing = render(redis, 'users-service', 'therrapp/users-service:abc');
    assert.notStrictEqual(missing.status, 0, 'zero matching lines must fail');
    assert.ok(missing.stderr.includes('found 0'), missing.stderr);

    const pinned = write('pinned.yaml', MANIFEST.replace(':latest', ':deadbeef'));
    assert.notStrictEqual(render(pinned, 'users-service', 'therrapp/users-service:abc').status, 0, 'a hand-pinned tag is not :latest and must fail');

    // Two candidate lines make the substitution ambiguous.
    const doubled = write('doubled.yaml', `${MANIFEST}      - name: again\n        image: therrapp/users-service:latest\n`);
    const ambiguous = render(doubled, 'users-service', 'therrapp/users-service:abc');
    assert.notStrictEqual(ambiguous.status, 0, 'two matching lines must fail');
    assert.ok(ambiguous.stderr.includes('found 2'), ambiguous.stderr);

    // The image name is matched whole: `users-service` must not render a
    // `users-service-v2` line, and vice versa.
    const sibling = write('sibling.yaml', MANIFEST.replace('therrapp/users-service:latest', 'therrapp/users-service-v2:latest'));
    assert.notStrictEqual(render(sibling, 'users-service', 'therrapp/users-service:abc').status, 0, 'a prefix match is not a match');

    // A missing file or argument is an error, not an empty render.
    assert.notStrictEqual(render(path.join(tmp, 'nope.yaml'), 'users-service', 'therrapp/users-service:abc').status, 0);
    assert.notStrictEqual(render(redis, 'users-service', '').status, 0, 'an empty image ref must fail');
}

// --- Against the real manifests ---------------------------------------------------------------

{
    // Every Deployment the registry knows about must render: this is the check that a
    // manifest edit (or a registry edit) has not broken the deploy's ability to pin it.
    const listRegistry = 'source ./_bin/lib/service-registry.sh; '
        + 'for k in $(service_keys); do echo "$k $(service_image "$k") $(service_deployment "$k")"; done';
    const registry = execFileSync('bash', ['-c', listRegistry], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
    }).trim().split('\n');

    for (const row of registry) {
        const [key, image, deployment] = row.split(' ');
        const manifest = path.join(REPO_ROOT, 'k8s', 'prod', `${deployment}.yaml`);
        const result = render(manifest, image, `therrapp/${image}:0123456789abcdef`);
        assert.strictEqual(result.status, 0, `${key}: ${result.stderr}`);
        assert.ok(result.text.includes(`image: therrapp/${image}:0123456789abcdef`), `${key}: rendered tag missing`);
    }
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log('render-manifest: all assertions passed');
