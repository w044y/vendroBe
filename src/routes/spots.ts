import { Router, Request, Response, NextFunction } from 'express';
import { SpotService } from '../services/spotService';
import { SpotType } from '../entities/Spot';
import { authenticateToken, optionalAuth } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';

const router = Router();
const spotService = new SpotService();

// GET /api/v1/spots - Get all spots (public)
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const limit = parseInt(req.query.limit as string) || 50;
        const offset = parseInt(req.query.offset as string) || 0;
        const spot_type = req.query.spot_type as SpotType;
        const is_verified = req.query.is_verified === 'true' ? true : req.query.is_verified === 'false' ? false : undefined;
        const min_rating = req.query.min_rating ? parseFloat(req.query.min_rating as string) : undefined;

        if (limit > 100) {
            throw createError('Limit cannot exceed 100', 400);
        }

        if (spot_type && !Object.values(SpotType).includes(spot_type)) {
            throw createError('Invalid spot_type. Valid types: ' + Object.values(SpotType).join(', '), 400);
        }

        if (min_rating && (min_rating < 0 || min_rating > 5)) {
            throw createError('min_rating must be between 0 and 5', 400);
        }

        const spots = await spotService.getAllSpots({
            limit,
            offset,
            spot_type,
            is_verified,
            min_rating
        });

        res.json({
            data: spots,
            pagination: { limit, offset, total: spots.length },
            filters: { spot_type, is_verified, min_rating }
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/v1/spots/nearby - Get spots near coordinates (public)
router.get('/nearby', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const latitude = parseFloat(req.query.latitude as string);
        const longitude = parseFloat(req.query.longitude as string);
        const radius = parseFloat(req.query.radius as string) || 10;
        const limit = parseInt(req.query.limit as string) || 20;

        if (!latitude || !longitude) {
            throw createError('latitude and longitude query parameters are required', 400);
        }

        if (latitude < -90 || latitude > 90) {
            throw createError('Invalid latitude. Must be between -90 and 90', 400);
        }

        if (longitude < -180 || longitude > 180) {
            throw createError('Invalid longitude. Must be between -180 and 180', 400);
        }

        if (radius <= 0 || radius > 100) {
            throw createError('radius must be between 0 and 100 km', 400);
        }

        const spots = await spotService.getNearbySpots(latitude, longitude, radius, limit);

        res.json({
            data: spots,
            search_center: { latitude, longitude },
            radius_km: radius,
            found: spots.length
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/v1/spots/:id - Get spot by ID (public)
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const spot = await spotService.getSpotById(req.params.id);
        res.json({ data: spot });
    } catch (error) {
        next(error);
    }
});

// POST /api/v1/spots - Create new spot (PROTECTED)
router.post('/', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const {
            name,
            description,
            latitude,
            longitude,
            spot_type,
            tips,
            accessibility_info,
            facilities
        } = req.body;

        // Validation
        if (!name || !description || !latitude || !longitude || !spot_type) {
            throw createError('name, description, latitude, longitude, and spot_type are required', 400);
        }

        if (!Object.values(SpotType).includes(spot_type)) {
            throw createError('Invalid spot_type. Valid types: ' + Object.values(SpotType).join(', '), 400);
        }

        const spot = await spotService.createSpot({
            name,
            description,
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude),
            spot_type,
            tips,
            accessibility_info,
            facilities: facilities || [],
            created_by_id: req.user!.userId // Use authenticated user ID
        });

        res.status(201).json({
            data: spot,
            message: 'Spot created successfully'
        });
    } catch (error) {
        next(error);
    }
});

// PUT /api/v1/spots/:id - Update spot (PROTECTED - own spots only)
router.put('/:id', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
    try {
        // First get the spot to check ownership
        const existingSpot = await spotService.getSpotById(req.params.id);

        if (existingSpot.created_by.id !== req.user!.userId) {
            throw createError('You can only update spots you created', 403);
        }

        const { name, description, tips, accessibility_info, facilities } = req.body;

        const spot = await spotService.updateSpot(req.params.id, {
            name,
            description,
            tips,
            accessibility_info,
            facilities
        });

        res.json({
            data: spot,
            message: 'Spot updated successfully'
        });
    } catch (error) {
        next(error);
    }
});

// DELETE /api/v1/spots/:id - Delete spot (PROTECTED - own spots only)
router.delete('/:id', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
    try {
        // First get the spot to check ownership
        const existingSpot = await spotService.getSpotById(req.params.id);

        if (existingSpot.created_by.id !== req.user!.userId) {
            throw createError('You can only delete spots you created', 403);
        }

        const result = await spotService.deleteSpot(req.params.id);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// POST /api/v1/spots/:id/reviews - Add review to spot (PROTECTED)
router.post('/:id/reviews', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const {
            safety_rating,
            overall_rating,
            comment,
            photos
        } = req.body;

        if (!safety_rating || !overall_rating) {
            throw createError('safety_rating and overall_rating are required', 400);
        }

        const review = await spotService.addSpotReview(req.params.id, {
            user_id: req.user!.userId, // Use authenticated user ID
            safety_rating: parseInt(safety_rating),
            overall_rating: parseInt(overall_rating),
            comment,
            photos: photos || []
        });

        res.status(201).json({
            data: review,
            message: 'Review added successfully'
        });
    } catch (error) {
        next(error);
    }
});

export default router;