import { Router, Request, Response, NextFunction } from 'express';
import { TripService } from '../services/tripService';
import { TripStatus } from '../entities/Trip';
import { createError } from '../middleware/errorHandler';
import {TripSpotStatus} from "../entities/TripSpot";

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
            user_id
        } = req.body;

        // Validation
        const required = ['title', 'start_address', 'end_address', 'start_latitude', 'start_longitude', 'end_latitude', 'end_longitude', 'user_id'];
        for (const field of required) {
            if (!req.body[field]) {
                throw createError(`${field} is required`, 400);
            }
        }

        const trip = await tripService.createTrip({
            title,
            description,
            start_address,
            end_address,
            start_latitude: parseFloat(start_latitude),
            start_longitude: parseFloat(start_longitude),
            end_latitude: parseFloat(end_latitude),
            end_longitude: parseFloat(end_longitude),
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

export default router;