import { Router, Request, Response, NextFunction } from 'express';
import { UserService } from '../services/userService';
import { createError } from '../middleware/errorHandler';

const router = Router();
const userService = new UserService();

// GET /api/v1/users - Get all users
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const limit = parseInt(req.query.limit as string) || 50;
        const offset = parseInt(req.query.offset as string) || 0;

        if (limit > 100) {
            throw createError('Limit cannot exceed 100', 400);
        }

        const users = await userService.getAllUsers(limit, offset);

        res.json({
            data: users,
            pagination: {
                limit,
                offset,
                total: users.length
            }
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/v1/users/:id - Get user by ID
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = await userService.getUserById(req.params.id);
        res.json({ data: user });
    } catch (error) {
        next(error);
    }
});

// POST /api/v1/users - Create new user
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, username, display_name, bio } = req.body;

        if (!email) {
            throw createError('Email is required', 400);
        }

        // Basic email validation
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

// PUT /api/v1/users/:id - Update user
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { username, display_name, bio, profile_photo_url } = req.body;

        const user = await userService.updateUser(req.params.id, {
            username,
            display_name,
            bio,
            profile_photo_url
        });

        res.json({
            data: user,
            message: 'User updated successfully'
        });
    } catch (error) {
        next(error);
    }
});

// DELETE /api/v1/users/:id - Delete user
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await userService.deleteUser(req.params.id);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// GET /api/v1/users/:id/stats - Get user statistics
router.get('/:id/stats', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const stats = await userService.getUserStats(req.params.id);
        res.json({ data: stats });
    } catch (error) {
        next(error);
    }
});

export default router;