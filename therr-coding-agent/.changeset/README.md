# Changesets

This folder is managed by [changesets](https://github.com/changesets/changesets).

To record a release-worthy change:

```bash
npx changeset
```

Pick the bump (patch/minor/major) and write a short summary. On release,
`npx changeset version` updates the version + changelog, and `npm run release`
(`changeset publish`) publishes to npm.
