import { DataSource } from 'typeorm';
import { User } from '../entities/User';
import { Spot } from '../entities/Spot';
import { SpotReview } from '../entities/SpotReview';
import { Trip } from '../entities/Trip';
import { TripSpot } from '../entities/TripSpot';
import { MagicToken } from '../entities/MagicToken';

export const AppDataSource = new DataSource({
    type: 'postgres',
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    username: process.env.DATABASE_USERNAME || 'hitchhub_user',
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME || 'hitchhub_dev',

    // Enable for development, disable in production
    synchronize: process.env.NODE_ENV === 'development',
    logging: process.env.NODE_ENV === 'development',

    entities: [User, Spot, SpotReview, Trip, TripSpot, MagicToken],

    migrations: ['src/migrations/*.ts'],
    subscribers: ['src/subscribers/*.ts'],
});

// Initialize connection
export const initializeDatabase = async () => {
    try {
        await AppDataSource.initialize();
        console.log('✅ Database connection established');
    } catch (error) {
        console.error('❌ Database connection failed:', error);
        process.exit(1);
    }
};