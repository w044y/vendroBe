import { Router, Request, Response, NextFunction } from 'express';
import { UserService } from '../services/userService';
import { authenticateToken, optionalAuth } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import { UserProfileService } from '../services/userProfileService';
import { ExperienceLevel, SafetyPriority } from '../entities/UserProfile';
import {AppDataSource} from "../config/database";
import {UserBadge} from "../entities/UserBadge";

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
router.post('/', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
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
router.delete('/:id', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
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



const userProfileService = new UserProfileService();

// GET /api/v1/users/me/profile
router.get('/me/profile', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            throw createError('User not authenticated', 401);
        }

        const profile = await userProfileService.getUserProfile(userId);

        if (!profile) {
            return res.status(404).json({
                error: {
                    message: 'Profile not found - onboarding needed',
                    statusCode: 404,
                    onboardingRequired: true
                }
            });
        }

        res.json({ data: profile });
    } catch (error) {
        next(error);
    }
});

// PUT /api/v1/users/me/profile
router.put('/me/profile', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            throw createError('User not authenticated', 401);
        }

        const updates = req.body;

        // Try to update existing profile first
        try {
            const profile = await userProfileService.updateUserProfile(userId, updates);
            res.json({
                data: profile,
                message: 'Profile updated successfully'
            });
        } catch (updateError: any) {
            // If profile doesn't exist, create it
            if (updateError.statusCode === 404) {
                const newProfile = await userProfileService.createUserProfile(userId, {
                    travelModes: updates.travelModes,
                    primaryMode: updates.primaryMode || updates.travelModes[0],
                    showAllSpots: updates.showAllSpots || false,
                    experienceLevel: updates.experienceLevel || ExperienceLevel.BEGINNER,
                    safetyPriority: updates.safetyPriority || SafetyPriority.HIGH,
                    onboardingCompleted: updates.onboardingCompleted || true
                });

                res.status(201).json({
                    data: newProfile,
                    message: 'Profile created successfully'
                });
            } else {
                throw updateError;
            }
        }
    } catch (error) {
        next(error);
    }
});

// DELETE /api/v1/users/me/profile
router.delete('/me/profile', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            throw createError('User not authenticated', 401);
        }

        const result = await userProfileService.deleteUserProfile(userId);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

router.get('/:id/complete-profile', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userProfileService = new UserProfileService();
        const completeProfile = await userProfileService.getCompleteUserProfile(req.params.id);

        res.json({
            data: completeProfile,
            message: 'Complete profile retrieved successfully'
        });
    } catch (error) {
        next(error);
    }

})
router.put('/me/profile/extended', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            throw createError('User not authenticated', 401);
        }

        const { bio, languages, countriesVisited, publicProfile, showStats } = req.body;

        const userProfileService = new UserProfileService();
        const updatedProfile = await userProfileService.updateExtendedProfile(userId, {
            bio,
            languages,
            countriesVisited,
            publicProfile,
            showStats
        });

        res.json({
            data: updatedProfile,
            message: 'Extended profile updated successfully'
        });
    } catch (error) {
        next(error);
    }
});


    router.post('/me/verify', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                throw createError('User not authenticated', 401);
            }

            const { type, metadata } = req.body;

            const userProfileService = new UserProfileService();
            await userProfileService.addVerification(userId, type, metadata);

            res.json({
                message: 'Verification added successfully'
            });
        } catch (error) {
            next(error);
        }
    });

    router.get('/:id/badges', async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userBadgeRepository = AppDataSource.getRepository(UserBadge);
            const badges = await userBadgeRepository.find({
                where: { user_id: req.params.id },
                order: { sort_order: 'ASC', earned_at: 'DESC' }
            });

            res.json({
                data: badges,
                message: 'Badges retrieved successfully'
            });
        } catch (error) {
            next(error);
        }
    });

// POST /api/v1/users/me/stats/refresh - Manually refresh profile stats
    router.post('/me/stats/refresh', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                throw createError('User not authenticated', 401);
            }

            const userProfileService = new UserProfileService();
            await userProfileService.updateProfileStats(userId);

            res.json({
                message: 'Profile statistics refreshed successfully'
            });
        } catch (error) {
            next(error);
        }
    });



export default router;