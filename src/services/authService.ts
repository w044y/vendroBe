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
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw createError('Invalid email format', 400);
        }

        // Check if user exists, if not create one
        let user = await this.userRepository.findOne({ where: { email } });

        if (!user) {
            // Auto-create user for magic link flow
            user = this.userRepository.create({
                email,
                display_name: email.split('@')[0], // Use email prefix as default name
            });
            user = await this.userRepository.save(user);
            console.log(`✅ Auto-created user for: ${email}`);
        }

        // Clean up old unused tokens for this email
        await this.magicTokenRepository.delete({
            email,
            is_used: false,
        });

        // Generate new magic token
        const token = generateMagicToken();
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 15); // 15 minutes expiry

        // Save magic token
        const magicToken = this.magicTokenRepository.create({
            email,
            token,
            expires_at: expiresAt,
        });
        await this.magicTokenRepository.save(magicToken);

        // Create magic link URL
        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const magicLink = `${baseUrl}/auth/verify?token=${token}&email=${encodeURIComponent(email)}`;

        // Send email
        await sendMagicLinkEmail(email, magicLink, user.display_name);

        console.log(`✅ Magic link sent to: ${email}`);
        console.log(`🔗 Magic link: ${magicLink}`); // Log for development

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
        // Find the magic token
        const magicToken = await this.magicTokenRepository.findOne({
            where: { token, email, is_used: false },
        });

        if (!magicToken) {
            throw createError('Invalid or expired magic link', 401);
        }

        // Check if token has expired
        if (new Date() > magicToken.expires_at) {
            throw createError('Magic link has expired', 401);
        }

        // Find the user
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