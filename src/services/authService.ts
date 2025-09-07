import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { MagicToken } from '../entities/MagicToken';
import { createError } from '../middleware/errorHandler';
import { generateToken, generateMagicToken, verifyToken } from '../utils/jwt';
import { sendMagicLinkEmail } from '../config/resend';
import {ExperienceLevel, SafetyPriority, UserProfile} from "../entities/UserProfile";
import {TransportMode} from "../enum/enums";

export class AuthService {
    private userRepository = AppDataSource.getRepository(User);
    private magicTokenRepository = AppDataSource.getRepository(MagicToken);
    private userProfileRepository = AppDataSource.getRepository(UserProfile);

    async sendMagicLink(email: string): Promise<{
        message: string;
        email: string;
    }> {
        const normalizedEmail = email.toLowerCase().trim();
        let user = await this.userRepository.findOne({
            where: { email: normalizedEmail },
            relations: ['profile']
        });

        // CREATE USER IF DOESN'T EXIST (unless it's a dev user)
        if (!user && !this.isDevEmail(normalizedEmail)) {
            console.log(`🆕 Creating new user for email: ${normalizedEmail}`);
            user = await this.createNewUser(normalizedEmail);
        } else if (!user && this.isDevEmail(normalizedEmail)) {
            console.log(`❌ Dev user ${normalizedEmail} should exist but doesn't. Check database setup.`);
            throw createError('Development user not found. Please run database setup.', 500);
        }

        // Clean up existing tokens
        await this.magicTokenRepository.delete({ email: normalizedEmail });

        let token: string;
        if (process.env.NODE_ENV === 'development') {
            if (this.isDevEmail(normalizedEmail)) {
                token = 'dev-token-12345'; // Fixed token for all dev users
                console.log(`🔧 Using development token for dev user: ${normalizedEmail}`);
            } else {
                token = `dev-token-${Date.now()}`; // Dynamic token for test users
                console.log(`🔧 Using dynamic dev token for: ${normalizedEmail}`);
            }
        } else {
            token = generateMagicToken();
        }

        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 15);

        const magicToken = this.magicTokenRepository.create({
            email: normalizedEmail,
            token,
            expires_at: expiresAt,
        });

        await this.magicTokenRepository.save(magicToken);

        // Send email only in production
        if (process.env.NODE_ENV !== 'development') {
            const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            const magicLink = `${baseUrl}/auth/verify?token=${token}&email=${encodeURIComponent(normalizedEmail)}`;
            await sendMagicLinkEmail(normalizedEmail, magicLink, user!.display_name);
        } else {
            console.log(`🔧 DEV: Magic link token for ${normalizedEmail}: ${token}`);
        }

        return {
            message: 'Magic link sent to your email',
            email: normalizedEmail,
        };
    }

    private isDevEmail(email: string): boolean {
        const devEmails = ['dev@vendro.app', 'alice@vendro.app', 'bob@vendro.app'];
        return devEmails.includes(email);
    }

    private async createNewUser(email: string): Promise<User> {
        const username = email.split('@')[0].toLowerCase();
        const displayName = username.charAt(0).toUpperCase() + username.slice(1);

        const user = this.userRepository.create({
            email,
            username,
            display_name: displayName,
            vendro_points: 0,
            safety_rating: 0,
            is_verified: false,
            total_distance: 0,
            countries_visited: [],
            preferred_language: 'en',
            is_active: true,
        });

        await this.userRepository.save(user);
        await this.createDefaultUserProfile(user.id);

        return user;
    }
    private async createDefaultUserProfile(userId: string): Promise<void> {
        try {
            const profile = this.userProfileRepository.create({
                user_id: userId,
                travel_modes: [TransportMode.HITCHHIKING], // Fix: Use enum instead of string
                primary_mode: TransportMode.HITCHHIKING,   // Fix: Use enum instead of string
                experience_level: ExperienceLevel.BEGINNER, // Fix: Use enum instead of string
                safety_priority: SafetyPriority.HIGH,       // Fix: Use enum instead of string
                email_verified: false,
                phone_verified: false,
                social_connected: false,
                community_vouches: 0,
                total_reviews: 0,
                helpful_reviews: 0,
                reviewer_rating: 0,
                spots_added: 0,
                verified_spots: 0,
                bio: '',
                languages: ['en'],
                countries_visited: [],
                show_all_spots: false,
                public_profile: true,
                show_stats: true,
                onboarding_completed: false,
            });

            await this.userProfileRepository.save(profile);
            console.log(`✅ Default profile created for user: ${userId}`);
        } catch (error) {
            console.error('❌ Failed to create default profile:', error);
            throw createError('Failed to create user profile', 500);
        }
    }
    // Enhanced dev login method
    async loginDevUser(email: string = 'dev@vendro.app'): Promise<{
        user: any;
        accessToken: string;
        message: string;
    }> {
        if (process.env.NODE_ENV !== 'development') {
            throw createError('Development login only available in development mode', 403);
        }

        const user = await this.userRepository.findOne({
            where: { email },
            relations: ['profile']
        });

        if (!user) {
            throw createError(`Development user ${email} not found. Please run database setup.`, 404);
        }

        const accessToken = generateToken({
            userId: user.id,
            email: user.email,
        });

        console.log(`✅ Development user logged in: ${email}`);

        return {
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                display_name: user.display_name,
                profile_photo_url: user.profile_photo_url,
                vendro_points: user.vendro_points,
                safety_rating: user.safety_rating,
                is_verified: user.is_verified,
                created_at: user.created_at,
                profile: user.profile,
            },
            accessToken,
            message: 'Development login successful',
        };
    }


    async verifyMagicLink(token: string, email: string): Promise<{
        user: User;
        accessToken: string;
        message: string;
    }> {
        const magicToken = await this.magicTokenRepository.findOne({
            where: { token, email, is_used: false },
        });

        if (!magicToken) {
            throw createError('Invalid or expired magic link', 401);
        }

        if (new Date() > magicToken.expires_at) {
            throw createError('Magic link has expired', 401);
        }

        const user = await this.userRepository.findOne({ where: { email } });
        if (!user) {
            throw createError('User not found', 404);
        }

        // Mark token as used
        magicToken.is_used = true;
        await this.magicTokenRepository.save(magicToken);

        // Generate JWT token
        const accessToken = generateToken({
            userId: user.id,
            email: user.email,
        });

        console.log(`✅ User authenticated: ${email}`);

        return {
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                display_name: user.display_name,
                profile_photo_url: user.profile_photo_url,
                vendro_points: user.vendro_points,
                safety_rating: user.safety_rating,
                is_verified: user.is_verified,
                created_at: user.created_at,
            } as User,
            accessToken,
            message: 'Successfully authenticated',
        };
    }

    async refreshToken(currentToken: string): Promise<{
        accessToken: string;
        user: User;
    }> {
        // Verify current token
        const payload = verifyToken(currentToken);

        // Find user to ensure they still exist
        const user = await this.userRepository.findOne({
            where: { id: payload.userId },
            select: ['id', 'email', 'username', 'display_name', 'profile_photo_url', 'vendro_points', 'safety_rating', 'is_verified']
        });

        if (!user) {
            throw createError('User not found', 404);
        }

        // Generate new token
        const accessToken = generateToken({
            userId: user.id,
            email: user.email,
        });

        return { accessToken, user };
    }

    async getCurrentUser(userId: string): Promise<any> {
        const user = await this.userRepository.findOne({
            where: { id: userId },
            relations: ['profile'],
            select: {
                id: true,
                email: true,
                username: true,
                display_name: true,
                profile_photo_url: true,
                bio: true,
                vendro_points: true,
                safety_rating: true,
                total_distance: true,
                countries_visited: true,
                is_verified: true,
                created_at: true,
                profile: {
                    id: true,
                    travel_modes: true,
                    primary_mode: true,
                    experience_level: true,
                    safety_priority: true,
                    email_verified: true,
                    phone_verified: true,
                    social_connected: true,
                    total_reviews: true,
                    spots_added: true,
                    bio: true,
                    languages: true,
                    countries_visited: true,
                    onboarding_completed: true,
                    public_profile: true,
                    show_stats: true,
                    created_at: true,
                    updated_at: true,
                }
            }
        });

        if (!user) {
            throw createError('User not found', 404);
        }

        // If user exists but has no profile, create one
        if (!user.profile) {
            console.log(`⚠️ User ${userId} missing profile, creating default profile`);
            await this.createDefaultUserProfile(userId);

            // Refetch user with profile
            return this.getCurrentUser(userId);
        }

        return user;
    }
    async debugTokens(email: string): Promise<any> {
        if (process.env.NODE_ENV !== 'development') {
            throw createError('Debug methods only available in development', 403);
        }

        const normalizedEmail = email.toLowerCase().trim();

        const tokens = await this.magicTokenRepository.find({
            where: { email: normalizedEmail },
            order: { created_at: 'DESC' },
            take: 10
        });

        return {
            email: normalizedEmail,
            tokens: tokens.map(t => ({
                token: t.token,
                is_used: t.is_used,
                expires_at: t.expires_at,
                created_at: t.created_at,
                expired: new Date() > t.expires_at
            }))
        };
    }
    async logout(token: string): Promise<{ message: string }> {
        // For JWT tokens, we can't invalidate them server-side without a blacklist
        // For now, we'll just verify the token is valid and return success
        // In production, you might want to implement a token blacklist in Redis

        try {
            verifyToken(token);
            return { message: 'Successfully logged out' };
        } catch (error) {
            throw createError('Invalid token', 401);
        }
    }
}