import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

const DB = process.env.DATABASE_URL ?? 'postgres';

if (!DB) {
    throw new Error('DATABASE_URL is not defined in environment variables');
}

const pool = new pg.Pool({
    connectionString: DB,
});

export const db = drizzle(pool);