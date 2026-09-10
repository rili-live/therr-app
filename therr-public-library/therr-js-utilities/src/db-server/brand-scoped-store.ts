import KnexBuilder, { Knex } from 'knex';
import { BrandVariations } from '../constants/enums/Branding';
import {
    BRAND_VARIATION_COLUMN,
    BrandScopeMode,
    applyBrandFilter,
    assertBrand,
    withBrandOnInsert,
} from '../db/brand-scoped';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export type BrandValue = BrandVariations | string;

// Structural shape that any service-local IConnection must satisfy.
// Loose on `query` so that pg.Pool, pg.Client, and test doubles all assign.
export interface IBrandScopedQueryRunner {
    query(...args: any[]): any;
}

export interface IBrandScopedConnection {
    read: IBrandScopedQueryRunner;
    write: IBrandScopedQueryRunner;
}

export default abstract class BrandScopedStore<TConn extends IBrandScopedConnection = IBrandScopedConnection> {
    protected db: TConn;

    protected readonly tableName: string;

    protected readonly mode: BrandScopeMode;

    constructor(db: TConn, tableName: string, mode: BrandScopeMode = 'shadow') {
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
