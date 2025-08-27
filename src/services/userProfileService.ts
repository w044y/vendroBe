// src/services/userProfileService.ts - New service for profile management
import { AppDataSource } from '../config/database';
import { UserProfile, ExperienceLevel, SafetyPriority } from '../entities/UserProfile';
import { User } from '../entities/User';
import { createError } from '../middleware/errorHandler';
import { TransportMode } from '../enum/enums';

export class UserProfileService {
    private userProfileRepository = AppDataSource.getRepository(UserProfile);
    private userRepository = AppDataSource.getRepository(User);

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

    async createUserProfile(userId: string, profileData: {
        travelModes: TransportMode[];
        primaryMode: TransportMode;
        showAllSpots?: boolean;
        experienceLevel?: ExperienceLevel;
        safetyPriority?: SafetyPriority;
        onboardingCompleted?: boolean;
    }) {
        // Verify user exists
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) {
            throw createError('User not found', 404);
        }

        // Check if profile already exists
        const existingProfile = await this.userProfileRepository.findOne({
            where: { user_id: userId }
        });

        if (existingProfile) {
            throw createError('Profile already exists', 409);
        }

        // Validate data
        if (!profileData.travelModes || profileData.travelModes.length === 0) {
            throw createError('At least one travel mode is required', 400);
        }

        if (!profileData.travelModes.includes(profileData.primaryMode)) {
            throw createError('Primary mode must be one of the selected travel modes', 400);
        }

        const profile = this.userProfileRepository.create({
            user_id: userId,
            travel_modes: profileData.travelModes,
            primary_mode: profileData.primaryMode,
            show_all_spots: profileData.showAllSpots || false,
            experience_level: profileData.experienceLevel || ExperienceLevel.BEGINNER,
            safety_priority: profileData.safetyPriority || SafetyPriority.HIGH,
            onboarding_completed: profileData.onboardingCompleted || true
        });

        const savedProfile = await this.userProfileRepository.save(profile);

        return this.formatProfileResponse(savedProfile);
    }

    async updateUserProfile(userId: string, updates: Partial<{
        travelModes: TransportMode[];
        primaryMode: TransportMode;
        showAllSpots: boolean;
        experienceLevel: ExperienceLevel;
        safetyPriority: SafetyPriority;
        onboardingCompleted: boolean;
    }>) {
        const profile = await this.userProfileRepository.findOne({
            where: { user_id: userId }
        });

        if (!profile) {
            throw createError('Profile not found', 404);
        }

        // Validate updates
        if (updates.travelModes) {
            if (updates.travelModes.length === 0) {
                throw createError('At least one travel mode is required', 400);
            }

            // If primaryMode is being updated or travelModes changed, validate compatibility
            const newPrimaryMode = updates.primaryMode || profile.primary_mode;
            if (!updates.travelModes.includes(newPrimaryMode)) {
                throw createError('Primary mode must be one of the selected travel modes', 400);
            }
        }

        if (updates.primaryMode && !profile.travel_modes.includes(updates.primaryMode)) {
            throw createError('Primary mode must be one of the selected travel modes', 400);
        }

        // Apply updates
        Object.assign(profile, updates);
        profile.updated_at = new Date();

        const updatedProfile = await this.userProfileRepository.save(profile);

        return this.formatProfileResponse(updatedProfile);
    }

    async deleteUserProfile(userId: string) {
        const profile = await this.userProfileRepository.findOne({
            where: { user_id: userId }
        });

        if (!profile) {
            throw createError('Profile not found', 404);
        }

        await this.userProfileRepository.remove(profile);

        return { message: 'Profile deleted successfully' };
    }

    private formatProfileResponse(profile: UserProfile) {
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

    // Helper method to get user's filtered preferences
    async getUserFilterPreferences(userId: string) {
        const profile = await this.userProfileRepository.findOne({
            where: { user_id: userId }
        });

        if (!profile) {
            // Return default preferences for users without profiles
            return {
                travelModes: [TransportMode.HITCHHIKING], // Default mode
                showAllSpots: true, // Show everything if no profile
                safetyPriority: SafetyPriority.HIGH
            };
        }

        return {
            travelModes: profile.show_all_spots ? [] : profile.travel_modes, // Empty array means show all
            showAllSpots: profile.show_all_spots,
            safetyPriority: profile.safety_priority
        };
    }
}