import { Request, Response, NextFunction } from 'express';
import { verifyToken, JwtPayload } from '../utils/jwt';
import { createError } from './errorHandler';

// Extend Express Request type to include user
declare global {
    namespace Express {
        interface Request {
            user?: JwtPayload;
        }
    }
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            throw createError('Access token is required', 401);
        }

        const user = verifyToken(token);
        req.user = user;
        next();
    } catch (error) {
        next(error);
    }
};

export const optionalAuth = (req: Request, res: Response, next: NextFunction): void => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];

        if (token) {
            const user = verifyToken(token);
            req.user = user;
        }

        next();
    } catch (error) {
        // For optional auth, we don't throw errors, just continue without user
        next();
    }
};