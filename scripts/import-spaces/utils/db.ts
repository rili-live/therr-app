/**
 * Shared Postgres pool factory for import-space CLI scripts.
 *
 * Centralizes the per-script `new Pool({...})` boilerplate so connection
 * settings and env-var names stay consistent across every script.
 */
import { Pool, PoolConfig } from 'pg';

export type DbTarget = 'maps' | 'users';

export interface ICreatePoolOptions {
  /** Which service's database to connect to (default: 'maps'). */
  target?: DbTarget;
  /** Max pool size (default: 5). */
  max?: number;
  /** Idle timeout in ms (default: 10000). */
  idleTimeoutMillis?: number;
  /** Connection timeout in ms (default: 10000). */
  connectionTimeoutMillis?: number;
}

function resolveDatabase(target: DbTarget): string {
  if (target === 'users') {
    return process.env.USERS_SERVICE_DATABASE || 'therr_dev_users';
  }
  return process.env.MAPS_SERVICE_DATABASE || 'therr_dev_maps';
}

/**
 * Create a Postgres connection pool pointed at the maps-service or
 * users-service database, using the standard write-replica env vars.
 */
export function createDbPool(options: ICreatePoolOptions = {}): Pool {
  const {
    target = 'maps',
    max = 5,
    idleTimeoutMillis = 10000,
    connectionTimeoutMillis = 10000,
  } = options;

  const config: PoolConfig = {
    host: process.env.DB_HOST_MAIN_WRITE,
    user: process.env.DB_USER_MAIN_WRITE,
    password: process.env.DB_PASSWORD_MAIN_WRITE,
    database: resolveDatabase(target),
    port: Number(process.env.DB_PORT_MAIN_WRITE) || 5432,
    max,
    idleTimeoutMillis,
    connectionTimeoutMillis,
  };

  return new Pool(config);
}

/**
 * Attempt a trivial query to verify the pool can reach the database.
 * Exits the process with a helpful message on failure; returns silently on success.
 */
export async function assertDbConnection(db: Pool, logFn: (msg: string) => void = console.log): Promise<void> {
  try {
    await db.query('SELECT 1');
    logFn('Database connection established.');
  } catch (err: any) {
    console.error(`Database connection failed: ${err.message}`);
    console.error('Make sure .env is configured with DB_HOST_MAIN_WRITE, DB_USER_MAIN_WRITE, etc.');
    await db.end().catch(() => undefined);
    process.exit(1);
  }
}
