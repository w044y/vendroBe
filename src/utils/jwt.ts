import jwt, {Secret} from 'jsonwebtoken';
import { createError } from '../middleware/errorHandler';

const JWT_SECRET: Secret = process.env.JWT_SECRET!;
const JWT_EXPIRES_IN:number = 1000;

if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required');
}

export interface JwtPayload {
    userId: string;
    email: string;
    iat?: number;
    exp?: number;
}

export const generateToken = (payload: { userId: string; email: string }): string => {
    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN
    });
};

export const verifyToken = (token: string): JwtPayload => {
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
        console.log('✅ JWT token verified for user:', decoded.userId);
        return decoded;
    } catch (error) {
        console.error('❌ JWT verification failed:', error);
        if (error instanceof jwt.TokenExpiredError) {
            throw createError('Token has expired', 401);
        } else if (error instanceof jwt.JsonWebTokenError) {
            throw createError('Invalid token', 401);
        } else {
            throw createError('Token verification failed', 401);
        }
    }
};

export const generateMagicToken = (): string => {
    const crypto = require('crypto');
    return crypto.randomBytes(32).toString('hex');
};

export const generateDevToken = (): string => {
    if (process.env.NODE_ENV !== 'development') {
        throw new Error('Dev tokens only available in development');
    }

    return generateToken({
        userId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', // Dev user ID
        email: 'dev@vendro.app',
    });
};