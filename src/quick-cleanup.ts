// Quick database cleanup - run this in your backend terminal
// src/quick-cleanup.ts (create this file)
import 'reflect-metadata';
import 'dotenv/config';
import { AppDataSource, initializeDatabase } from './config/database';

async function cleanup() {
    await initializeDatabase();

    // Clean up problematic data
    await AppDataSource.query('DELETE FROM magic_tokens WHERE email = $1', ['dev@vendro.app']);
    await AppDataSource.query('DELETE FROM user_profiles WHERE user_id IN (SELECT id FROM users WHERE email = $1)', ['dev@vendro.app']);

    console.log('✅ Cleaned up dev user data');

    await AppDataSource.destroy();
}

cleanup();