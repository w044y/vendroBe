import { Router, Request, Response, NextFunction } from 'express';
import { SpotService } from '../services/spotService';
import { authenticateToken, optionalAuth } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import {SpotType, TRANSPORT_MODE_LABELS, TransportMode} from "../enum/enums";


const router = Router();
const spotService = new SpotService();


router.get('/filtered', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const {
            transport_modes,
            latitude,
            longitude,
            radius = 10,
            limit = 50,
            offset = 0,
            spot_type,
            min_rating,
            safety_priority
        } = req.query;

        let transportModeFilter: TransportMode[] | undefined;
        if (transport_modes) {
            const modesArray = (transport_modes as string).split(',') as TransportMode[];
            // Validate transport modes
            const validModes = Object.values(TransportMode);
            transportModeFilter = modesArray.filter(mode => validModes.includes(mode));
        }

        const filters: any = {
            limit: Math.min(parseInt(limit as string), 100), // Cap at 100
            offset: parseInt(offset as string),
            transportModes: transportModeFilter,
        };

        // Add user ID for personalized filtering if authenticated
        if (req.user?.userId) {
            filters.userId = req.user.userId;
        }

        // Add location filtering
        if (latitude && longitude) {
            filters.latitude = parseFloat(latitude as string);
            filters.longitude = parseFloat(longitude as string);
            filters.radius = Math.min(parseFloat(radius as string), 100); // Cap at 100km
        }

        // Add other filters
        if (spot_type && Object.values(SpotType).includes(spot_type as SpotType)) {
            filters.spotType = spot_type as SpotType;
        }

        if (min_rating) {
            const rating = parseFloat(min_rating as string);
            if (rating >= 0 && rating <= 5) {
                filters.minRating = rating;
            }
        }

        if (safety_priority && ['high', 'medium', 'low'].includes(safety_priority as string)) {
            filters.safetyPriority = safety_priority as 'high' | 'medium' | 'low';
        }

        const spots = await spotService.getSpotsFiltered(filters);

        res.json({
            data: spots,
            pagination: {
                limit: filters.limit,
                offset: filters.offset,
                total: spots.length
            },
            filters: {
                transport_modes: transportModeFilter,
                location: filters.latitude ? {
                    latitude: filters.latitude,
                    longitude: filters.longitude,
                    radius: filters.radius
                } : null,
                spot_type,
                min_rating: filters.minRating,
                safety_priority,
                personalized: !!req.user?.userId
            },
            message: req.user?.userId
                ? 'Results personalized for your travel preferences'
                : 'Showing filtered results'
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/v1/spots/for-mode/:mode - Get best spots for specific transport mode
router.get('/for-mode/:mode', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { mode } = req.params;
        const { latitude, longitude, radius, min_effectiveness, limit, offset } = req.query;

        if (!Object.values(TransportMode).includes(mode as TransportMode)) {
            throw createError('Invalid transport mode', 400);
        }

        const spots = await spotService.getSpotsByTransportModeQuality(mode as TransportMode, {
            latitude: latitude ? parseFloat(latitude as string) : undefined,
            longitude: longitude ? parseFloat(longitude as string) : undefined,
            radius: radius ? parseFloat(radius as string) : undefined,
            minEffectiveness: min_effectiveness ? parseFloat(min_effectiveness as string) : undefined,
            limit: limit ? parseInt(limit as string) : undefined,
            offset: offset ? parseInt(offset as string) : undefined
        });

        res.json({
            data: spots,
            mode,
            criteria: {
                min_effectiveness: min_effectiveness || 4.0,
                location: latitude && longitude ? { latitude, longitude, radius } : null
            },
            message: `Best spots for ${TRANSPORT_MODE_LABELS[mode as TransportMode]}`
        });
    } catch (error) {
        next(error);
    }
});


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
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
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
            created_by_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'// Use authenticated user ID
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

router.post('/:id/reviews', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const {
            transport_mode,
            safety_rating,
            effectiveness_rating,
            overall_rating,
            comment,
            wait_time_minutes,
            legal_status,
            facility_rating,
            accessibility_rating,
            review_latitude,
            review_longitude,
            photos,
            context
        } = req.body;

        // Validation
        if (!transport_mode || !safety_rating || !effectiveness_rating || !overall_rating) {
            throw createError('transport_mode, safety_rating, effectiveness_rating, and overall_rating are required', 400);
        }

        if (!Object.values(TransportMode).includes(transport_mode)) {
            throw createError(`Invalid transport_mode. Valid modes: ${Object.values(TransportMode).join(', ')}`, 400);
        }

        if (safety_rating < 1 || safety_rating > 5 || effectiveness_rating < 1 || effectiveness_rating > 5 || overall_rating < 1 || overall_rating > 5) {
            throw createError('Ratings must be between 1 and 5', 400);
        }

        const review = await spotService.addSpotReview(req.params.id, {
            user_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', // Use dev user for now
            transport_mode,
            safety_rating: parseInt(safety_rating),
            effectiveness_rating: parseInt(effectiveness_rating),
            overall_rating: parseInt(overall_rating),
            comment,
            wait_time_minutes: wait_time_minutes ? parseInt(wait_time_minutes) : undefined,
            legal_status: legal_status ? parseInt(legal_status) : undefined,
            facility_rating: facility_rating ? parseInt(facility_rating) : undefined,
            accessibility_rating: accessibility_rating ? parseInt(accessibility_rating) : undefined,
            review_latitude: review_latitude ? parseFloat(review_latitude) : undefined,
            review_longitude: review_longitude ? parseFloat(review_longitude) : undefined,
            photos: photos || [],
            context: context || null
        });

        res.status(201).json({
            data: review,
            message: 'Review added successfully'
        });
    } catch (error) {
        next(error);
    }
});

router.get('/:id/reviews', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { transport_mode, limit, offset, sort_by } = req.query;

        const filters: any = {};

        if (transport_mode) {
            if (!Object.values(TransportMode).includes(transport_mode as TransportMode)) {
                throw createError(`Invalid transport_mode. Valid modes: ${Object.values(TransportMode).join(', ')}`, 400);
            }
            filters.transport_mode = transport_mode as TransportMode;
        }

        if (limit) filters.limit = parseInt(limit as string);
        if (offset) filters.offset = parseInt(offset as string);
        if (sort_by) filters.sort_by = sort_by as 'newest' | 'oldest' | 'most_helpful';

        const reviews = await spotService.getSpotReviews(req.params.id, filters);

        res.json({
            data: reviews,
            message: 'Reviews retrieved successfully',
            filters_applied: filters
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/v1/spots/:id/reviews/summary - Get aggregated review summary
router.get('/:id/reviews/summary', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const spot = await spotService.getSpotById(req.params.id);

        if (!spot) {
            throw createError('Spot not found', 404);
        }

        const summary = {
            total_reviews: spot.total_reviews,
            overall_safety_rating: spot.safety_rating,
            overall_rating: spot.overall_rating,
            last_reviewed: spot.last_reviewed,
            mode_ratings: spot.mode_ratings || {},
            transport_modes_available: spot.transport_modes || []
        };

        res.json({
            data: summary,
            message: 'Review summary retrieved successfully'
        });
    } catch (error) {
        next(error);
    }
});

// src/routes/spots.ts - Add filtered endpoint

// GET /api/v1/spots/filtered - New smart filtering endpoint
router.get('/filtered', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const {
            transport_modes,
            latitude,
            longitude,
            radius = 10,
            limit = 50,
            offset = 0
        } = req.query;

        let transportModeFilter: TransportMode[] | undefined;
        if (transport_modes) {
            transportModeFilter = (transport_modes as string).split(',') as TransportMode[];
        }

        const spots = await spotService.getSpotsFiltered({
            transportModes: transportModeFilter,
            latitude: latitude ? parseFloat(latitude as string) : undefined,
            longitude: longitude ? parseFloat(longitude as string) : undefined,
            radius: parseInt(radius as string),
            limit: parseInt(limit as string),
            offset: parseInt(offset as string)
        });

        res.json({
            data: spots,
            filters: {
                transport_modes: transportModeFilter,
                latitude,
                longitude,
                radius,
                total_found: spots.length
            }
        });
    } catch (error) {
        next(error);
    }
});

export default router;