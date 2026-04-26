import KnexBuilder, { Knex } from 'knex';
// eslint-disable-next-line import/extensions, import/no-unresolved
import { BrandVariations } from 'therr-js-utilities/constants';
import {
    BRAND_VARIATION_COLUMN,
    BrandScopeMode,
    applyBrandFilter,
    assertBrand,
    withBrandOnInsert,
// eslint-disable-next-line import/extensions, import/no-unresolved
} from 'therr-js-utilities/db';
import { IConnection } from './connection';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export type BrandValue = BrandVariations | string;

export default abstract class BrandScopedStore {
    protected db: IConnection;

    protected readonly tableName: string;

    protected readonly mode: BrandScopeMode;

    constructor(db: IConnection, tableName: string, mode: BrandScopeMode = 'shadow') {
        this.db = db;
        this.tableName = tableName;
        this.mode = mode;
    }

    protected assertBrand(brand: BrandValue | undefined | null) {
        assertBrand(brand, { tableName: this.tableName, mode: this.mode });
    }

    protected scopedQuery(brand: BrandValue) {
        this.assertBrand(brand);
        return knexBuilder.from(this.tableName)
            .where(`${this.tableName}.${BRAND_VARIATION_COLUMN}`, '=', brand);
    }

    protected withBrand<TBuilder extends { andWhere:(...args: any[]) => TBuilder }>(qb: TBuilder, brand: BrandValue): TBuilder {
        this.assertBrand(brand);
        return applyBrandFilter(qb, this.tableName, brand);
    }

    protected scopedInsert<T extends Record<string, unknown>>(brand: BrandValue, row: T) {
        this.assertBrand(brand);
        return knexBuilder.insert(withBrandOnInsert(row, brand)).into(this.tableName);
    }

    protected scopedUpdate(brand: BrandValue, conditions: Record<string, unknown>) {
        this.assertBrand(brand);
        return knexBuilder
            .from(this.tableName)
            .where(`${this.tableName}.${BRAND_VARIATION_COLUMN}`, '=', brand)
            .where(conditions);
    }
}
