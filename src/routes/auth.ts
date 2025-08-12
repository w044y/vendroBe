import { Router, Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/authService';
import { authenticateToken } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';

const router = Router();
const authService = new AuthService();

// POST /api/v1/auth/magic-link - Send magic link
router.post('/magic-link', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email } = req.body;

        if (!email) {
            throw createError('Email is required', 400);
        }

        const result = await authService.sendMagicLink(email.toLowerCase().trim());

        res.json(result);
    } catch (error) {
        next(error);
    }
});

// POST /api/v1/auth/verify - Verify magic link and get JWT
router.post('/verify', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { token, email } = req.body;

        if (!token || !email) {
            throw createError('Token and email are required', 400);
        }

        const result = await authService.verifyMagicLink(token, email.toLowerCase().trim());

        res.json(result);
    } catch (error) {
        next(error);
    }
});

// POST /api/v1/auth/refresh - Refresh JWT token
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            throw createError('Token is required', 400);
        }

        const result = await authService.refreshToken(token);

        res.json(result);
    } catch (error) {
        next(error);
    }
});

// GET /api/v1/auth/me - Get current user info
router.get('/me', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            throw createError('User not authenticated', 401);
        }

        const user = await authService.getCurrentUser(req.user.userId);

        res.json({ data: user });
    } catch (error) {
        next(error);
    }
});

// POST /api/v1/auth/logout - Logout user
router.post('/logout', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            throw createError('Token is required', 400);
        }

        const result = await authService.logout(token);

        res.json(result);
    } catch (error) {
        next(error);
    }
});

export default router;