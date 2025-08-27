import { DataSource } from 'typeorm';
import { User } from '../entities/User';
import { Spot } from '../entities/Spot';
import { SpotReview } from '../entities/SpotReview';
import { Trip } from '../entities/Trip';
import { TripSpot } from '../entities/TripSpot';
import { TripCollaborator } from '../entities/TripCollaborator';
import { TripLocationHistory } from '../entities/TripLocationHistory';
import { MagicToken } from '../entities/MagicToken';
import {UserProfile} from "@/entities/UserProfile";

export const AppDataSource = new DataSource({
    type: 'postgres',
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    username: process.env.DATABASE_USERNAME || 'postgres',
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME || 'vendro_dev',

    synchronize: process.env.NODE_ENV === 'development',
    logging: process.env.NODE_ENV === 'development',

    entities: [
        User,
        UserProfile,
        Spot,
        SpotReview,
        Trip,
        TripSpot,
        TripCollaborator,
        TripLocationHistory,
        MagicToken
    ],

    migrations: ['src/migrations/*.ts'],
    subscribers: ['src/subscribers/*.ts'],
});

export const initializeDatabase = async () => {
    try {
        await AppDataSource.initialize();
        console.log('✅ Database connection established');
        console.log('📊 Connected entities:', AppDataSource.entityMetadatas.map(e => e.name));
    } catch (error) {
        console.error('❌ Database connection failed:', error);
        process.exit(1);
    }
};