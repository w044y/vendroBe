import { DataSource } from 'typeorm';
import { User } from '../entities/User';
import { Spot } from '../entities/Spot';
import { SpotReview } from '../entities/SpotReview';
import { Trip } from '../entities/Trip';
import { TripSpot } from '../entities/TripSpot';
import { TripCollaborator } from '../entities/TripCollaborator';
import { TripLocationHistory } from '../entities/TripLocationHistory';
import { MagicToken } from '../entities/MagicToken';
import {ExperienceLevel, SafetyPriority, UserProfile} from "../entities/UserProfile";
import {UserBadge} from "../entities/UserBadge";
import {TrustVerification} from "../entities/TrustVerification";
import {TransportMode} from "../enum/enums";

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
        UserBadge,
        TrustVerification,
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

// src/config/database.ts - Add this after database initialization
export const setupDevelopmentData = async () => {
    if (process.env.NODE_ENV !== 'development') {
        return;
    }

    console.log('🔧 Setting up development data...');

    const userRepository = AppDataSource.getRepository(User);
    const profileRepository = AppDataSource.getRepository(UserProfile);

    // Check if dev user exists
    let devUser = await userRepository.findOne({
        where: { email: 'dev@vendro.app' },
        relations: ['profile']
    });

    if (!devUser) {
        console.log('🆕 Creating development user...');

        // Create dev user
        devUser = userRepository.create({
            id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', // Fixed UUID for consistency
            email: 'dev@vendro.app',
            username: 'devuser',
            display_name: 'Dev User',
            vendro_points: 250,
            safety_rating: 4.5,
            is_verified: true,
            total_distance: 1250.5,
            countries_visited: ['US', 'CA', 'FR', 'DE'],
            preferred_language: 'en',
            is_active: true,
        });

        await userRepository.save(devUser);
        console.log('✅ Development user created');
    }

    // Check if dev user has profile
    if (!devUser.profile) {
        console.log('🆕 Creating development user profile...');

        const devProfile = profileRepository.create({
            user_id: devUser.id,
            travel_modes: [TransportMode.HITCHHIKING, TransportMode.CYCLING, TransportMode.VAN_LIFE],
            primary_mode: TransportMode.HITCHHIKING,
            experience_level: ExperienceLevel.EXPERT,
            safety_priority: SafetyPriority.MEDIUM,
            email_verified: true,
            phone_verified: true,
            social_connected: true,
            community_vouches: 15,
            total_reviews: 42,
            helpful_reviews: 38,
            reviewer_rating: 4.7,
            spots_added: 23,
            verified_spots: 18,
            bio: 'Experienced hitchhiker and travel enthusiast. Love exploring new places and meeting fellow travelers!',
            languages: ['en', 'fr', 'de'],
            countries_visited: ['US', 'CA', 'FR', 'DE', 'ES', 'IT'],
            show_all_spots: true,
            public_profile: true,
            show_stats: true,
            onboarding_completed: true, // Dev user has completed onboarding
        });

        await profileRepository.save(devProfile);
        console.log('✅ Development user profile created');
    }

    // Create additional dev users for testing
    await createAdditionalDevUsers(userRepository, profileRepository);

};

async function createAdditionalDevUsers(userRepository: any, profileRepository: any) {
    const additionalUsers = [
        {
            id: 'b1aab999-8c1b-4df8-bb7d-6bb9bd380a22',
            email: 'alice@vendro.app',
            username: 'alice_traveler',
            display_name: 'Alice Explorer',
            profile: {
                travel_modes: [TransportMode.CYCLING, TransportMode.WALKING],
                primary_mode: TransportMode.CYCLING,
                experience_level: ExperienceLevel.INTERMEDIATE,
                bio: 'Cycling enthusiast exploring Europe one pedal at a time!',
                countries_visited: ['FR', 'ES', 'IT', 'CH'],
            }
        },
        {
            id: 'c2bbc888-7c2c-4ef8-bb8d-6bb9bd380a33',
            email: 'bob@vendro.app',
            username: 'bob_hitchhiker',
            display_name: 'Bob Road Warrior',
            profile: {
                travel_modes: [TransportMode.HITCHHIKING, TransportMode.VAN_LIFE],
                primary_mode: TransportMode.HITCHHIKING,
                experience_level: ExperienceLevel.EXPERT,
                bio: 'Been hitchhiking for 10+ years across 4 continents!',
                countries_visited: ['US', 'MX', 'CA', 'AU', 'NZ', 'TH'],
            }
        }
    ];

    for (const userData of additionalUsers) {
        const existingUser = await userRepository.findOne({ where: { email: userData.email } });

        if (!existingUser) {
            const user = userRepository.create({
                id: userData.id,
                email: userData.email,
                username: userData.username,
                display_name: userData.display_name,
                vendro_points: Math.floor(Math.random() * 500) + 100,
                safety_rating: 3.5 + Math.random() * 1.5,
                is_verified: true,
                is_active: true,
            });

            await userRepository.save(user);

            const profile = profileRepository.create({
                user_id: user.id,
                ...userData.profile,
                email_verified: true,
                onboarding_completed: true,
            });

            await profileRepository.save(profile);
            console.log(`✅ Created additional dev user: ${userData.email}`);
        }
    }
}