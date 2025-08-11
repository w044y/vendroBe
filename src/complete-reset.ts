import 'reflect-metadata';
import 'dotenv/config';
import { Client } from 'pg';

async function completeReset() {
    console.log('🔄 Performing complete database reset...');

    const dbConfig = {
        host: process.env.DATABASE_HOST || 'localhost',
        port: parseInt(process.env.DATABASE_PORT || '5432'),
        user: process.env.DATABASE_USERNAME || 'postgres',
        password: process.env.DATABASE_PASSWORD,
    };

    const dbName = process.env.DATABASE_NAME || 'vendro_dev';

    try {
        // Connect to postgres database (not our app database)
        const client = new Client({ ...dbConfig, database: 'postgres' });
        await client.connect();

        console.log('🔌 Connected to PostgreSQL');

        // Terminate existing connections to our database
        await client.query(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = '${dbName}' AND pid <> pg_backend_pid()
    `);

        // Drop the database
        await client.query(`DROP DATABASE IF EXISTS "${dbName}"`);
        console.log(`🗑️ Dropped database: ${dbName}`);

        // Recreate the database
        await client.query(`CREATE DATABASE "${dbName}"`);
        console.log(`✅ Created database: ${dbName}`);

        await client.end();

        // Now connect to the new database and enable PostGIS
        const newDbClient = new Client({ ...dbConfig, database: dbName });
        await newDbClient.connect();

        await newDbClient.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
        await newDbClient.query('CREATE EXTENSION IF NOT EXISTS "postgis"');
        console.log('✅ PostGIS extensions enabled');

        await newDbClient.end();

        console.log('🎉 Database reset complete!');

    } catch (error) {
        console.error('❌ Reset failed:', error);
    }
}

completeReset();