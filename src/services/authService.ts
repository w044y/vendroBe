import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { MagicToken } from '../entities/MagicToken';
import { createError } from '../middleware/errorHandler';
import { generateToken, generateMagicToken, verifyToken } from '../utils/jwt';
import { sendMagicLinkEmail } from '../config/resend';

export class AuthService {
    private userRepository = AppDataSource.getRepository(User);
    private magicTokenRepository = AppDataSource.getRepository(MagicToken);

    async sendMagicLink(email: string): Promise<{ message: string; email: string }> {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw createError('Invalid email format', 400);
        }

        let user = await this.userRepository.findOne({ where: { email } });
        if (!user) {
            // PROBLEM: This might be trying to create a user with duplicate email/username
            try {
                await this.magicTokenRepository.delete({
                    email,
                    is_used: false,
                });    user = this.userRepository.create({
                    email,
                    display_name: email.split('@')[0], // This could cause username conflicts
                    username: email.split('@')[0], // ADD: Make username unique
                });
                user = await this.userRepository.save(user);
                console.log(`✅ Auto-created user for: ${email}`);
            } catch (createError: any) {
                // Handle duplicate constraint error
                if (createError.code === '23505') { // PostgreSQL unique violation code
                    console.log(`⚠️ User might already exist, trying to find: ${email}`);
                    user = await this.userRepository.findOne({ where: { email } });
                    if (!user) {
                        throw createError('Failed to create or find user', 500);
                    }
                } else {
                    throw createError;
                }
            }
        }


        await this.magicTokenRepository.delete({
            email,
            is_used: false,
        });

        // Generate token
        let token: string;
        if (process.env.NODE_ENV === 'development' && email === 'dev@vendro.app') {
            // Use predictable token for development
            token = `dev-magic-token-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            console.log('🔧 Using development magic token for:', email, 'Token:', token);
        } else {
            token = generateMagicToken();
        }

        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 15);

        const magicToken = this.magicTokenRepository.create({
            email,
            token,
            expires_at: expiresAt,
        });
        try {
            await this.magicTokenRepository.save(magicToken);
            console.log('✅ Magic token saved successfully');
        } catch (saveError: any) {
            console.error('❌ Failed to save magic token:', saveError);
            // If it's still a duplicate, force delete and retry
            if (saveError.code === '23505') {
                console.log('🔧 Constraint violation, force cleaning tokens...');
                await this.magicTokenRepository.query(
                    'DELETE FROM magic_tokens WHERE email = $1',
                    [email]
                );
                await this.magicTokenRepository.save(magicToken);
                console.log('✅ Token saved after cleanup');
            } else {
                throw saveError;
            }
        }

        // Send email only in production or if explicitly requested
        if (process.env.NODE_ENV !== 'development' || process.env.SEND_DEV_EMAILS === 'true') {
            const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            const magicLink = `${baseUrl}/auth/verify?token=${token}&email=${encodeURIComponent(email)}`;
            await sendMagicLinkEmail(email, magicLink, user.display_name);
        }

        console.log(`✅ Magic link prepared for: ${email}`);
        if (process.env.NODE_ENV === 'development') {
            console.log(`🔗 Development token: ${token}`);
        }

        return {
            message: 'Magic link sent to your email',
            email,
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

    async getCurrentUser(userId: string): Promise<User> {
        const user = await this.userRepository.findOne({
            where: { id: userId },
            select: ['id', 'email', 'username', 'display_name', 'profile_photo_url', 'bio', 'vendro_points', 'safety_rating', 'total_distance', 'countries_visited', 'is_verified', 'created_at']
        });

        if (!user) {
            throw createError('User not found', 404);
        }

        return user;
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