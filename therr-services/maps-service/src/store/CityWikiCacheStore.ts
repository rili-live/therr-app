import KnexBuilder, { Knex } from 'knex';
import { IConnection } from './connection';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export const CITY_WIKI_CACHE_TABLE_NAME = 'main.cityWikiCache';

export interface ICityWikiSections {
    understand?: string;
    districts?: string;
    getIn?: string;
    getAround?: string;
}

export interface ICityWikiCacheRow {
    slug: string;
    locale: string;
    resolvedTitle?: string | null;
    summary?: string | null;
    sections?: ICityWikiSections | null;
    heroImageUrl?: string | null;
    attributionUrl?: string | null;
    license?: string | null;
    localeFallback?: boolean;
    status: 'ok' | 'not_found' | 'error';
    fetchedAt?: Date;
    expiresAt?: Date | null;
}

export interface IUpsertCityWikiCacheParams {
    slug: string;
    locale: string;
    resolvedTitle?: string | null;
    summary?: string | null;
    sections?: ICityWikiSections | null;
    heroImageUrl?: string | null;
    attributionUrl?: string | null;
    license?: string | null;
    localeFallback?: boolean;
    status: 'ok' | 'not_found' | 'error';
    ttlDays?: number;
}

class CityWikiCacheStore {
    private db: IConnection;

    constructor(dbConnection: IConnection) {
        this.db = dbConnection;
    }

    /**
     * Fetch a single row by slug + locale. Returns null if no row exists.
     * Callers handle "expired" vs "missing" — both cases may trigger a background refresh.
     */
    get(slug: string, locale: string): Promise<ICityWikiCacheRow | null> {
        const queryString = knexBuilder
            .select('*')
            .from(CITY_WIKI_CACHE_TABLE_NAME)
            .where({ slug, locale })
            .limit(1)
            .toString();

        return this.db.read.query(queryString).then((response) => {
            if (!response.rows.length) return null;
            const row = response.rows[0];
            return {
                slug: row.slug,
                locale: row.locale,
                resolvedTitle: row.resolvedTitle,
                summary: row.summary,
                sections: row.sections,
                heroImageUrl: row.heroImageUrl,
                attributionUrl: row.attributionUrl,
                license: row.license,
                localeFallback: row.localeFallback,
                status: row.status,
                fetchedAt: row.fetchedAt,
                expiresAt: row.expiresAt,
            };
        });
    }

    isFresh(row: ICityWikiCacheRow | null): boolean {
        if (!row) return false;
        if (!row.expiresAt) return true;
        return new Date(row.expiresAt).getTime() > Date.now();
    }

    upsert(params: IUpsertCityWikiCacheParams): Promise<any> {
        const ttlDays = params.ttlDays ?? 30;
        const now = new Date();
        const expiresAt = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);

        const insertRow: any = {
            slug: params.slug,
            locale: params.locale,
            resolvedTitle: params.resolvedTitle ?? null,
            summary: params.summary ?? null,
            sections: params.sections ? JSON.stringify(params.sections) : null,
            heroImageUrl: params.heroImageUrl ?? null,
            attributionUrl: params.attributionUrl ?? null,
            license: params.license ?? 'CC-BY-SA-4.0',
            localeFallback: params.localeFallback ?? false,
            status: params.status,
            fetchedAt: now,
            expiresAt,
        };

        const queryString = knexBuilder(CITY_WIKI_CACHE_TABLE_NAME)
            .insert(insertRow)
            .onConflict(['slug', 'locale'])
            .merge({
                resolvedTitle: insertRow.resolvedTitle,
                summary: insertRow.summary,
                sections: insertRow.sections,
                heroImageUrl: insertRow.heroImageUrl,
                attributionUrl: insertRow.attributionUrl,
                license: insertRow.license,
                localeFallback: insertRow.localeFallback,
                status: insertRow.status,
                fetchedAt: insertRow.fetchedAt,
                expiresAt: insertRow.expiresAt,
            })
            .toString();

        return this.db.write.query(queryString);
    }

    findExpired(limit = 50): Promise<ICityWikiCacheRow[]> {
        const queryString = knexBuilder
            .select('*')
            .from(CITY_WIKI_CACHE_TABLE_NAME)
            .where('expiresAt', '<=', new Date())
            .limit(limit)
            .toString();

        return this.db.read.query(queryString).then((response) => response.rows);
    }
}

export default CityWikiCacheStore;
