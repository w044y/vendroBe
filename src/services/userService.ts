import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { createError } from '../middleware/errorHandler';
import {UserProfile} from "../entities/UserProfile";

export class UserService {
    private userRepository = AppDataSource.getRepository(User);
    private userProfileRepository = AppDataSource.getRepository(UserProfile);

    async getAllUsers(limit: number = 50, offset: number = 0) {
        return await this.userRepository.find({
            take: limit,
            skip: offset,
            order: { created_at: 'DESC' },
            select: ['id', 'email', 'username', 'display_name', 'profile_photo_url', 'vendro_points', 'safety_rating', 'is_verified', 'created_at']
        });
    }

    async getUserById(id: string) {
        const user = await this.userRepository.findOne({
            where: { id },
            select: ['id', 'email', 'username', 'display_name', 'profile_photo_url', 'bio', 'vendro_points', 'safety_rating', 'total_distance', 'countries_visited', 'is_verified', 'created_at']
        });

        if (!user) {
            throw createError('User not found', 404);
        }

        return user;
    }
    async getUserByEmail(email: string) {
        return await this.userRepository.findOne({
            where: { email },
            select: ['id', 'email', 'username', 'display_name', 'profile_photo_url', 'vendro_points', 'safety_rating', 'is_verified']
        });
    }

    async getUserProfile(userId: string) {
        const profile = await this.userProfileRepository.findOne({
            where: { user_id: userId },
            relations: ['user']
        });

        if (!profile) {
            return null; // No profile means user needs onboarding
        }

        return {
            userId: profile.user_id,
            travelModes: profile.travel_modes,
            preferences: {
                primaryMode: profile.primary_mode,
                showAllSpots: profile.show_all_spots,
                experienceLevel: profile.experience_level,
                safetyPriority: profile.safety_priority
            },
            onboardingCompleted: profile.onboarding_completed,
            createdAt: profile.created_at,
            updatedAt: profile.updated_at
        };
    }

    async createUser(userData: {
        email: string;
        username?: string;
        display_name?: string;
        bio?: string;
    }) {
        // Check if email already exists
        const existingUser = await this.userRepository.findOne({ where: { email: userData.email } });
        if (existingUser) {
            throw createError('User with this email already exists', 409);
        }

        // Check if username already exists (if provided)
        if (userData.username) {
            const existingUsername = await this.userRepository.findOne({ where: { username: userData.username } });
            if (existingUsername) {
                throw createError('Username already taken', 409);
            }
        }

        const user = this.userRepository.create(userData);
        return await this.userRepository.save(user);
    }

    async updateUser(id: string, updateData: {
        username?: string;
        display_name?: string;
        bio?: string;
        profile_photo_url?: string;
    }) {
        const user = await this.getUserById(id);

        // Check username uniqueness if being updated
        if (updateData.username && updateData.username !== user.username) {
            const existingUsername = await this.userRepository.findOne({ where: { username: updateData.username } });
            if (existingUsername) {
                throw createError('Username already taken', 409);
            }
        }

        Object.assign(user, updateData);
        return await this.userRepository.save(user);
    }

    async deleteUser(id: string) {
        const user = await this.getUserById(id);
        await this.userRepository.remove(user);
        return { message: 'User deleted successfully' };
    }

    async getUserStats(id: string) {
        const user = await this.getUserById(id);

        // Get user's spots count
        const spotsCount = await AppDataSource.getRepository('Spot').count({ where: { created_by_id: id } });

        // Get user's trips count
        const tripsCount = await AppDataSource.getRepository('Trip').count({ where: { user_id: id } });

        return {
            user: {
                id: user.id,
                display_name: user.display_name,
                vendro_points: user.vendro_points,
                safety_rating: user.safety_rating,
                total_distance: user.total_distance,
                countries_visited: user.countries_visited,
            },
            stats: {
                spots_created: spotsCount,
                trips_completed: tripsCount,
                member_since: user.created_at,
            }
        };
    }
}