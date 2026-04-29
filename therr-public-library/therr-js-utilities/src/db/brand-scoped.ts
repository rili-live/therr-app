import { BrandVariations } from '../constants/enums/Branding';

export const BRAND_VARIATION_COLUMN = 'brandVariation';

export type BrandScopeMode = 'shadow' | 'enforce';

export class MissingBrandContextError extends Error {
    constructor(tableName: string) {
        super(`Brand-scoped table "${tableName}" was queried without a brandVariation. `
            + 'Pass brandVariation from getBrandContext(req.headers) and route the call through BrandScopedStore.');
        this.name = 'MissingBrandContextError';
    }
}

const KNOWN_BRANDS = new Set<string>(Object.values(BrandVariations));

export const isKnownBrand = (value: unknown): value is BrandVariations => typeof value === 'string' && KNOWN_BRANDS.has(value);

interface AssertBrandOpts {
    tableName: string;
    mode?: BrandScopeMode;
}

export function assertBrand(
    brand: BrandVariations | string | undefined | null,
    opts: AssertBrandOpts,
): asserts brand is BrandVariations {
    const mode = opts.mode || 'enforce';
    if (!brand || !isKnownBrand(brand)) {
        if (mode === 'shadow') {
            // eslint-disable-next-line no-console
            console.warn(
                `[brand-scope:shadow] table=${opts.tableName} missing or unknown brandVariation=${String(brand)} `
                + '(would throw in enforce mode)',
            );
            return;
        }
        throw new MissingBrandContextError(opts.tableName);
    }
}

export const applyBrandFilter = <TBuilder extends { andWhere: (...args: any[]) => TBuilder }>(
    qb: TBuilder,
    tableName: string,
    brand: BrandVariations | string,
): TBuilder => qb.andWhere(`${tableName}.${BRAND_VARIATION_COLUMN}`, '=', brand);

export const withBrandOnInsert = <T extends Record<string, unknown>>(
    row: T,
    brand: BrandVariations | string,
): T & { brandVariation: string } => ({ ...row, [BRAND_VARIATION_COLUMN]: brand });
