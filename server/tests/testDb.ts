import 'dotenv/config';
import { pool } from '../src/db';

export async function resetTestDb(): Promise<void> {
  await pool.query('TRUNCATE friendships, user_jobs, users CASCADE');
}
