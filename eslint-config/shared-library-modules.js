// The monorepo's shared libraries, by package name as they appear in import specifiers.
//
// These are workspace siblings resolved through TypeScript path aliases (and the
// `import/resolver` alias map in each package's ESLint settings), not npm dependencies —
// they are deliberately absent from every consumer's package.json. Without the settings
// below, `import/no-extraneous-dependencies` fires on *every* import of them: dozens of
// warnings per lint run across the services. That volume is not harmless, because it
// buries the warnings that report a genuinely missing dependency.
//
// TWO settings are exported here, and only one of them actually does the work:
//
//   SHARED_LIBRARY_INTERNAL_REGEX → 'import/internal-regex'  ← this is the effective one
//   SHARED_LIBRARY_MODULES        → 'import/core-modules'    ← defense in depth only
//
// `import/core-modules` looks like the natural fit but is inert for these packages.
// eslint-plugin-import's `isBuiltIn(name, settings, path)` opens with
// `if (path || !name) return false` — a module that the resolver successfully resolved to
// a real file is never treated as core, so the core-modules list is never consulted. Our
// alias map resolves all three libraries, so that path is always taken. It is kept only
// for the case where resolution fails (a package built without its `lib/` present), where
// it does take effect.
//
// `import/internal-regex` is checked first in `typeTest()`, before resolution is
// considered, and classifies these imports as 'internal'. `no-extraneous-dependencies`
// early-returns on anything that is not 'external' (its `verifyInternalDeps` option
// defaults to false), which is what silences the noise. airbnb-base's `import/order`
// puts 'builtin', 'external', and 'internal' in the same group, so reclassifying these
// does not change any required import ordering.
const SHARED_LIBRARY_MODULES = [
    'therr-js-utilities',
    'therr-react',
    'therr-styles',
    // The *published* name in therr-js-utilities/package.json. Nothing imports this
    // string, but it is what the rule reports after following the resolved path to its
    // nearest package.json, so it is listed to match either spelling.
    'therr-public-library-utilities',
];

// Matches a bare import of one of the libraries or any subpath of it
// (`therr-js-utilities`, `therr-js-utilities/constants`, `therr-react/services`).
const SHARED_LIBRARY_INTERNAL_REGEX = `^(${SHARED_LIBRARY_MODULES.join('|')})(/|$)`;

module.exports = {
    SHARED_LIBRARY_MODULES,
    SHARED_LIBRARY_INTERNAL_REGEX,
};
