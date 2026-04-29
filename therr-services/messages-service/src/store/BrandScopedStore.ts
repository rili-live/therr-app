// Re-export of the shared base class. The class itself lives in
// therr-public-library/therr-js-utilities/src/db-server/brand-scoped-store.ts
// so all services share a single implementation; existing imports of './BrandScopedStore' continue to work.
// eslint-disable-next-line import/extensions, import/no-unresolved
import BrandScopedStore, { BrandValue } from 'therr-js-utilities/db-server';

export { BrandValue };
export default BrandScopedStore;
