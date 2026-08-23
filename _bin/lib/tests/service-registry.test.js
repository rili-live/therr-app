// Tests for the service registry — the one list build, publish and deploy iterate.
//
// The registry replaced three hand-maintained if-chains that had to agree with each
// other, with k8s/prod, and with the rollout wave plan. Nothing checked that they
// did, and the way they failed was silent: a service present in two of the three
// lists built and published on every stage merge and then never deployed, with the
// deploy log saying nothing about it at all.
//
// `assert_service_registry` is what makes that impossible, so these tests are mostly
// about proving it actually fails on each kind of drift rather than passing by
// default.

const assert = require('assert');
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const REGISTRY_LIB = path.join(REPO_ROOT, '_bin', 'lib', 'service-registry.sh');

const bash = (snippet, opts = {}) => execFileSync('bash', ['-c', `source ./_bin/lib/service-registry.sh\n${snippet}`], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    ...opts,
}).trim();

// --- The registry as it actually stands --------------------------------------------------------

{
    const result = spawnSync('bash', [REGISTRY_LIB], { cwd: REPO_ROOT, encoding: 'utf8' });
    assert.strictEqual(result.status, 0, `The committed registry must validate:\n${result.stderr}`);
}

{
    // Every registry Deployment must also be claimed by a rollout wave. These are two
    // separate files that both enumerate services; drift between them means a service
    // either escapes the skew ordering or is named by a plan with no manifest.
    const unwaved = execFileSync('bash', ['-c', `
        source ./_bin/lib/rollout-waves.sh
        source ./_bin/lib/service-registry.sh
        for KEY in $(service_keys); do
            DEPLOYMENT="$(service_deployment "$KEY")"
            FOUND=false
            for WAVE in "\${ROLLOUT_WAVES[@]}"; do
                for MEMBER in $WAVE; do
                    [ "$MEMBER" = "$DEPLOYMENT" ] && FOUND=true
                done
            done
            [ "$FOUND" = "true" ] || echo "$KEY"
        done
    `], { cwd: REPO_ROOT, encoding: 'utf8' }).trim();

    assert.strictEqual(unwaved, '', 'Every registry service must be placed in a rollout wave.');
}

{
    // The migratable subset must name real registry keys, or run-migrations.sh silently
    // skips a service that owns migrations.
    const keys = bash('service_keys').split('\n');
    const migratable = bash('echo "$THERR_MIGRATABLE_SERVICES"').split(/\s+/);

    for (const key of migratable) {
        assert.ok(keys.includes(key), `THERR_MIGRATABLE_SERVICES names '${key}', which is not a registry key`);
    }
}

{
    // An unknown key must fail rather than echo an empty string: a typo'd key that
    // resolves to "" disables a build or deploy step without saying so.
    const result = spawnSync('bash', ['-c', 'source ./_bin/lib/service-registry.sh; service_image no-such-service'], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
    });

    assert.notStrictEqual(result.status, 0);
    assert.match(result.stderr, /Unknown service key/);
}

{
    // Each service's source list must include the libraries compiled into its image.
    // Dropping therr-js-utilities from a backend service is the change that makes a
    // shared-library fix build for some services and not others.
    for (const key of bash('service_keys').split('\n')) {
        const sources = bash(`service_sources ${key}`);
        assert.ok(
            sources.includes('therr-public-library/therr-js-utilities'),
            `${key} must rebuild when therr-js-utilities changes`,
        );
        assert.ok(sources.includes('global-config.js'), `${key} must rebuild when global-config.js changes`);
    }

    // The web container additionally bundles therr-react and therr-styles.
    const webSources = bash('service_sources client-web');
    assert.ok(webSources.includes('therr-public-library/therr-react'));
    assert.ok(webSources.includes('therr-public-library/therr-styles'));
    assert.ok(webSources.includes('therr-client-web-dashboard'), 'the dashboard ships inside the web container');
}

// --- Proving the validator fails on drift ------------------------------------------------------

// Runs assert_service_registry against a copy of the repo's k8s/prod with one file
// mutated, and returns the validator's stderr.
const withMutatedManifests = (mutate) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'service-registry-'));
    const k8sDir = path.join(dir, 'prod');

    fs.cpSync(path.join(REPO_ROOT, 'k8s', 'prod'), k8sDir, { recursive: true });
    mutate(k8sDir);

    try {
        return spawnSync('bash', ['-c', 'source ./_bin/lib/service-registry.sh; assert_service_registry'], {
            cwd: REPO_ROOT,
            encoding: 'utf8',
            env: { ...process.env, K8S_PROD_DIR: k8sDir },
        });
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
};

{
    // Sanity: the copy validates unmutated, so the failures below are the mutation.
    const result = withMutatedManifests(() => {});
    assert.strictEqual(result.status, 0, result.stderr);
}

{
    // A Deployment whose manifest was deleted must fail, not be skipped.
    const result = withMutatedManifests((k8sDir) => {
        fs.rmSync(path.join(k8sDir, 'users-service-deployment.yaml'));
    });

    assert.notStrictEqual(result.status, 0);
    assert.match(result.stderr, /users-service names a Deployment with no manifest/);
}

{
    // The container name is what `kubectl set image` addresses. A rename in the
    // manifest with no matching registry update makes every image bump for that
    // service a no-op — this is the drift most likely to go unnoticed.
    const result = withMutatedManifests((k8sDir) => {
        const file = path.join(k8sDir, 'users-service-deployment.yaml');
        fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('- name: server-users', '- name: server-users-renamed'));
    });

    assert.notStrictEqual(result.status, 0);
    assert.match(result.stderr, /users-service names container 'server-users', which .* does not define/);
}

{
    // A new Deployment running a therrapp/ image with no registry row would never be
    // built or deployed by anything, and nothing would say so.
    const result = withMutatedManifests((k8sDir) => {
        fs.copyFileSync(
            path.join(k8sDir, 'users-service-deployment.yaml'),
            path.join(k8sDir, 'brand-new-service-deployment.yaml'),
        );
    });

    assert.notStrictEqual(result.status, 0);
    assert.match(result.stderr, /brand-new-service-deployment runs a therrapp\/ image but has no entry/);
}

console.log('service-registry: all assertions passed');
