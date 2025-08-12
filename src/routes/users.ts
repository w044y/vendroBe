import { Router, Request, Response, NextFunction } from 'express';
import { UserService } from '../services/userService';
import { authenticateToken, optionalAuth } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';

const router = Router();
const userService = new UserService();

// GET /api/v1/users - Get all users (public, but optional auth for user context)
router.get('/', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const limit = parseInt(req.query.limit as string) || 50;
        const offset = parseInt(req.query.offset as string) || 0;

        if (limit > 100) {
            throw createError('Limit cannot exceed 100', 400);
        }

        const users = await userService.getAllUsers(limit, offset);

        res.json({
            data: users,
            pagination: { limit, offset, total: users.length },
            authenticated: !!req.user
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/v1/users/:id - Get user by ID (public)
router.get('/:id', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = await userService.getUserById(req.params.id);
        res.json({
            data: user,
            isOwnProfile: req.user?.userId === req.params.id
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/v1/users - Create new user (protected - admin only or auth service)
router.post('/', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, username, display_name, bio } = req.body;

        if (!email) {
            throw createError('Email is required', 400);
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw createError('Invalid email format', 400);
        }

        const user = await userService.createUser({ email, username, display_name, bio });

        res.status(201).json({
            data: user,
            message: 'User created successfully'
        });
    } catch (error) {
        next(error);
    }
});

// PUT /api/v1/users/:id - Update user (protected - own profile only)
router.put('/:id', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Users can only update their own profile
        if (req.user?.userId !== req.params.id) {
            throw createError('You can only update your own profile', 403);
        }

        const { username, display_name, bio, profile_photo_url } = req.body;

        const user = await userService.updateUser(req.params.id, {
            username,
            display_name,
            bio,
            profile_photo_url
        });

        res.json({
            data: user,
            message: 'Profile updated successfully'
        });
    } catch (error) {
        next(error);
    }
});

// DELETE /api/v1/users/:id - Delete user (protected - own account only)
router.delete('/:id', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Users can only delete their own account
        if (req.user?.userId !== req.params.id) {
            throw createError('You can only delete your own account', 403);
        }

        const result = await userService.deleteUser(req.params.id);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// GET /api/v1/users/:id/stats - Get user statistics (public)
router.get('/:id/stats', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const stats = await userService.getUserStats(req.params.id);
        res.json({ data: stats });
    } catch (error) {
        next(error);
    }
});

export default router;