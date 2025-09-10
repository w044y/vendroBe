import { Router, Request, Response, NextFunction } from 'express';
import { TripService } from '../services/tripService';
import {TripPrivacyLevel, TripStatus} from '../entities/Trip';
import { createError } from '../middleware/errorHandler';
import {TripSpotStatus} from "../entities/TripSpot";
import {authenticateToken} from "../middleware/auth";
import {RealityEntry} from "../types/tripTypes";

const router = Router();
const tripService = new TripService();

// GET /api/v1/trips - Get all trips with filters
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const limit = parseInt(req.query.limit as string) || 50;
        const offset = parseInt(req.query.offset as string) || 0;
        const status = req.query.status as TripStatus;
        const is_public = req.query.is_public === 'true' ? true : req.query.is_public === 'false' ? false : undefined;
        let user_id = req.query.user_id as string;
        if (user_id === 'current') {
            if (process.env.NODE_ENV === 'development') {
                // Use dev user in development
                user_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
                console.log('🔧 [DEV] Using development user for trips query');
            } else {
                // In production, get from authenticated user
                if (!req.user?.userId) {
                    throw createError('Authentication required', 401);
                }
                user_id = req.user.userId;
            }
        }
        if (limit > 100) {
            throw createError('Limit cannot exceed 100', 400);
        }

        if (status && !Object.values(TripStatus).includes(status)) {
            throw createError('Invalid status. Valid statuses: ' + Object.values(TripStatus).join(', '), 400);
        }

        const trips = await tripService.getAllTrips({
            limit,
            offset,
            status,
            is_public,
            user_id
        });

        res.json({
            data: trips,
            pagination: {
                limit,
                offset,
                total: trips.length
            },
            filters: {
                status,
                is_public,
                user_id
            }
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/v1/trips/:id - Get trip by ID with full details
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const trip = await tripService.getTripById(req.params.id);
        res.json({ data: trip });
    } catch (error) {
        next(error);
    }
});

// POST /api/v1/trips - Create new trip
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        console.log('📝 Request body:', JSON.stringify(req.body, null, 2)); // Debug log

        const {
            title,
            description,
            start_address,
            end_address,
            start_latitude,
            start_longitude,
            end_latitude,
            end_longitude,
            planned_start_date,
            estimated_distance,
            travel_modes,
            tags,
            user_id,
            intention_notes  // ADD this for enhanced trips
        } = req.body;

        // Enhanced validation with better error messages
        const requiredFields = [
            { field: 'title', value: title },
            { field: 'start_address', value: start_address },
            { field: 'end_address', value: end_address },
            { field: 'start_latitude', value: start_latitude },
            { field: 'start_longitude', value: start_longitude },
            { field: 'end_latitude', value: end_latitude },
            { field: 'end_longitude', value: end_longitude },
            { field: 'user_id', value: user_id }
        ];

        for (const { field, value } of requiredFields) {
            if (value === undefined || value === null || value === '') {
                console.log(`❌ Missing field: ${field}, received:`, value);
                throw createError(`${field} is required`, 400);
            }
        }

        // Additional validation for coordinates
        const lat1 = parseFloat(start_latitude);
        const lng1 = parseFloat(start_longitude);
        const lat2 = parseFloat(end_latitude);
        const lng2 = parseFloat(end_longitude);

        if (isNaN(lat1) || isNaN(lng1) || isNaN(lat2) || isNaN(lng2)) {
            throw createError('Invalid coordinates provided', 400);
        }

        const trip = await tripService.createTrip({
            title,
            description,
            start_address,
            end_address,
            start_latitude: lat1,
            start_longitude: lng1,
            end_latitude: lat2,
            end_longitude: lng2,
            planned_start_date: planned_start_date ? new Date(planned_start_date) : undefined,
            estimated_distance: estimated_distance ? parseFloat(estimated_distance) : undefined,
            travel_modes: travel_modes || ['hitchhiking'],
            tags: tags || [],
            user_id
        });

        res.status(201).json({
            data: trip,
            message: 'Trip created successfully'
        });
    } catch (error) {
        console.log('❌ Trip creation error:', error);
        next(error);
    }
});

// PUT /api/v1/trips/:id - Update trip
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const {
            title,
            description,
            planned_start_date,
            status,
            actual_start_date,
            actual_end_date,
            actual_distance,
            tags,
            notes
        } = req.body;

        // Validate status if provided
        if (status && !Object.values(TripStatus).includes(status)) {
            throw createError('Invalid status. Valid statuses: ' + Object.values(TripStatus).join(', '), 400);
        }

        const trip = await tripService.updateTrip(req.params.id, {
            title,
            description,
            planned_start_date: planned_start_date ? new Date(planned_start_date) : undefined,
            status,
            actual_start_date: actual_start_date ? new Date(actual_start_date) : undefined,
            actual_end_date: actual_end_date ? new Date(actual_end_date) : undefined,
            actual_distance: actual_distance ? parseFloat(actual_distance) : undefined,
            tags,
            notes
        });

        res.json({
            data: trip,
            message: 'Trip updated successfully'
        });
    } catch (error) {
        next(error);
    }
});

// DELETE /api/v1/trips/:id - Delete trip
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await tripService.deleteTrip(req.params.id);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// POST /api/v1/trips/:id/spots - Add spot to trip
router.post('/:id/spots', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { spot_id, order_index } = req.body;

        if (!spot_id) {
            throw createError('spot_id is required', 400);
        }

        const tripSpot = await tripService.addSpotToTrip(req.params.id, {
            spot_id,
            order_index: order_index !== undefined ? parseInt(order_index) : undefined
        });

        res.status(201).json({
            data: tripSpot,
            message: 'Spot added to trip successfully'
        });
    } catch (error) {
        next(error);
    }
});

// PUT /api/v1/trips/spots/:tripSpotId - Update trip spot status/details
router.put('/spots/:tripSpotId', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const {
            status,
            arrived_at,
            departed_at,
            wait_time_hours,
            got_ride,
            ride_details,
            notes,
            safety_experience,
            effectiveness_rating
        } = req.body;

        // Validate status if provided
        if (status && !Object.values(TripSpotStatus).includes(status)) {
            throw createError('Invalid status. Valid statuses: ' + Object.values(TripSpotStatus).join(', '), 400);
        }

        // Validate ratings if provided
        if (safety_experience && (safety_experience < 1 || safety_experience > 5)) {
            throw createError('safety_experience must be between 1 and 5', 400);
        }
        if (effectiveness_rating && (effectiveness_rating < 1 || effectiveness_rating > 5)) {
            throw createError('effectiveness_rating must be between 1 and 5', 400);
        }

        const tripSpot = await tripService.updateTripSpot(req.params.tripSpotId, {
            status,
            arrived_at: arrived_at ? new Date(arrived_at) : undefined,
            departed_at: departed_at ? new Date(departed_at) : undefined,
            wait_time_hours: wait_time_hours ? parseFloat(wait_time_hours) : undefined,
            got_ride,
            ride_details,
            notes,
            safety_experience: safety_experience ? parseInt(safety_experience) : undefined,
            effectiveness_rating: effectiveness_rating ? parseInt(effectiveness_rating) : undefined
        });

        res.json({
            data: tripSpot,
            message: 'Trip spot updated successfully'
        });
    } catch (error) {
        next(error);
    }
});

// DELETE /api/v1/trips/spots/:tripSpotId - Remove spot from trip
router.delete('/spots/:tripSpotId', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await tripService.removeSpotFromTrip(req.params.tripSpotId);
        res.json(result);
    } catch (error) {
        next(error);
    }
});
router.post('/:id/fork', authenticateToken, async (req, res, next) => {
    try {
        const originalTrip = await tripService.getTripById(req.params.id);

        // Check if trip allows forking
        if (originalTrip.privacy_level === TripPrivacyLevel.PRIVATE_DRAFT) {
            throw createError('This trip cannot be forked', 403);
        }

        const forkedTrip = await tripService.forkTrip(req.params.id, req.user!.userId);

        res.status(201).json({
            data: forkedTrip,
            message: 'Trip forked successfully'
        });
    } catch (error) {
        next(error);
    }
});

// Add reality entry during live phase
// src/routes/trips.ts - Fix the addRealityEntry call

router.post('/:id/reality', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const {
            planned_spot_id,
            actual_location,
            experience_rating,
            worth_it_rating,
            notes,
            wish_i_knew,
            photos = []
        } = req.body;

        // Handle development mode
        let userId = req.user?.userId;
        if (process.env.NODE_ENV === 'development' && !userId) {
            userId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
        }

        if (!userId) {
            throw createError('Authentication required', 401);
        }

        // FIXED: Properly type the planned_vs_reality field
        const realityData: Omit<RealityEntry, 'id' | 'timestamp' | 'added_by'> = {
            planned_spot_id,
            actual_location,
            planned_vs_reality: planned_spot_id ? 'matched' : 'spontaneous', // Remove 'as const'
            experience_rating: Number(experience_rating), // Ensure it's a number
            worth_it_rating,
            photos: photos || [],
            notes: notes || '',
            wish_i_knew: wish_i_knew || ''
        };

        const updatedTrip = await tripService.addRealityEntry(
            req.params.id,
            userId,
            realityData
        );

        res.status(201).json({
            data: updatedTrip.reality_tracking[updatedTrip.reality_tracking.length - 1],
            message: 'Reality entry added successfully'
        });
    } catch (error) {
        next(error);
    }
});

// Browse public trips
router.get('/browse', async (req, res, next) => {
    try {
        const {
            travel_style,
            region,
            duration_days,
            transport_modes,
            limit = 20,
            offset = 0
        } = req.query;

        const trips = await tripService.browsePublicTrips({
            travel_style: travel_style as string,
            region: region as string,
            duration_days: duration_days ? parseInt(duration_days as string) : undefined,
            transport_modes: transport_modes ? (transport_modes as string).split(',') : undefined,
            limit: parseInt(limit as string),
            offset: parseInt(offset as string)
        });

        res.json({
            data: trips,
            message: 'Public trips retrieved'
        });
    } catch (error) {
        next(error);
    }
});

// Vote on trip helpfulness
router.post('/:id/vote', authenticateToken, async (req, res, next) => {
    try {
        const { helpful } = req.body;

        await tripService.voteOnTrip(req.params.id, req.user!.userId, helpful);

        res.json({
            message: 'Vote recorded'
        });
    } catch (error) {
        next(error);
    }
});
export default router;