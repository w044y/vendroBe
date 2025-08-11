import { AppDataSource } from '../config/database';
import { Trip, TripStatus } from '../entities/Trip';
import { TripSpot, TripSpotStatus } from '../entities/TripSpot';
import { createError } from '../middleware/errorHandler';

export class TripService {
    private tripRepository = AppDataSource.getRepository(Trip);
    private tripSpotRepository = AppDataSource.getRepository(TripSpot);

    async getAllTrips(filters: {
        limit?: number;
        offset?: number;
        status?: TripStatus;
        is_public?: boolean;
        user_id?: string;
    } = {}) {
        const { limit = 50, offset = 0, status, is_public, user_id } = filters;

        const query = this.tripRepository.createQueryBuilder('trip')
            .leftJoinAndSelect('trip.user', 'user')
            .select([
                'trip.id', 'trip.title', 'trip.description', 'trip.start_address', 'trip.end_address',
                'trip.planned_start_date', 'trip.status', 'trip.estimated_distance', 'trip.carbon_saved',
                'trip.travel_modes', 'trip.countries_visited', 'trip.tags', 'trip.created_at',
                'user.id', 'user.display_name', 'user.username'
            ])
            .orderBy('trip.created_at', 'DESC')
            .take(limit)
            .skip(offset);

        if (status) {
            query.andWhere('trip.status = :status', { status });
        }

        if (is_public !== undefined) {
            query.andWhere('trip.is_public = :isPublic', { isPublic: is_public });
        }

        if (user_id) {
            query.andWhere('trip.user_id = :userId', { userId: user_id });
        }

        return await query.getMany();
    }

    async getTripById(id: string) {
        const trip = await this.tripRepository.findOne({
            where: { id },
            relations: ['user', 'trip_spots', 'trip_spots.spot'],
            select: {
                user: { id: true, display_name: true, username: true, safety_rating: true },
                trip_spots: {
                    id: true, order_index: true, status: true, arrived_at: true, departed_at: true,
                    wait_time_hours: true, got_ride: true, notes: true,
                    spot: { id: true, name: true, latitude: true, longitude: true, spot_type: true }
                }
            }
        });

        if (!trip) {
            throw createError('Trip not found', 404);
        }

        // Sort trip spots by order
        trip.trip_spots.sort((a, b) => a.order_index - b.order_index);

        return trip;
    }

    async createTrip(tripData: {
        title: string;
        description?: string;
        start_address: string;
        end_address: string;
        start_latitude: number;
        start_longitude: number;
        end_latitude: number;
        end_longitude: number;
        planned_start_date?: Date;
        estimated_distance?: number;
        travel_modes?: string[];
        tags?: string[];
        user_id: string;
    }) {
        // Validate coordinates
        const coords = [
            { lat: tripData.start_latitude, lng: tripData.start_longitude, name: 'start' },
            { lat: tripData.end_latitude, lng: tripData.end_longitude, name: 'end' }
        ];

        for (const coord of coords) {
            if (coord.lat < -90 || coord.lat > 90) {
                throw createError(`Invalid ${coord.name} latitude. Must be between -90 and 90`, 400);
            }
            if (coord.lng < -180 || coord.lng > 180) {
                throw createError(`Invalid ${coord.name} longitude. Must be between -180 and 180`, 400);
            }
        }

        const trip = this.tripRepository.create({
            title: tripData.title,
            description: tripData.description,
            start_address: tripData.start_address,
            end_address: tripData.end_address,
            start_location: {
                type: 'Point',
                coordinates: [tripData.start_longitude, tripData.start_latitude]
            } as any,
            end_location: {
                type: 'Point',
                coordinates: [tripData.end_longitude, tripData.end_latitude]
            } as any,
            planned_start_date: tripData.planned_start_date,
            estimated_distance: tripData.estimated_distance,
            travel_modes: tripData.travel_modes || ['hitchhiking'],
            tags: tripData.tags || [],
            user_id: tripData.user_id
        });

        return await this.tripRepository.save(trip);
    }

    async updateTrip(id: string, updateData: {
        title?: string;
        description?: string;
        planned_start_date?: Date;
        status?: TripStatus;
        actual_start_date?: Date;
        actual_end_date?: Date;
        actual_distance?: number;
        tags?: string[];
        notes?: string;
    }) {
        const trip = await this.getTripById(id);
        Object.assign(trip, updateData);
        return await this.tripRepository.save(trip);
    }

    async deleteTrip(id: string) {
        const trip = await this.getTripById(id);
        await this.tripRepository.remove(trip);
        return { message: 'Trip deleted successfully' };
    }

    async addSpotToTrip(tripId: string, spotData: {
        spot_id: string;
        order_index?: number;
    }) {
        // Check if trip exists
        await this.getTripById(tripId);

        // Get next order index if not provided
        if (spotData.order_index === undefined) {
            const maxOrder = await this.tripSpotRepository
                .createQueryBuilder('tripSpot')
                .select('MAX(tripSpot.order_index)', 'maxOrder')
                .where('tripSpot.trip_id = :tripId', { tripId })
                .getRawOne();

            spotData.order_index = (maxOrder.maxOrder || -1) + 1;
        }

        const tripSpot = this.tripSpotRepository.create({
            trip_id: tripId,
            spot_id: spotData.spot_id,
            order_index: spotData.order_index
        });

        return await this.tripSpotRepository.save(tripSpot);
    }

    async updateTripSpot(tripSpotId: string, updateData: {
        status?: TripSpotStatus;
        arrived_at?: Date;
        departed_at?: Date;
        wait_time_hours?: number;
        got_ride?: boolean;
        ride_details?: string;
        notes?: string;
        safety_experience?: number;
        effectiveness_rating?: number;
    }) {
        const tripSpot = await this.tripSpotRepository.findOne({ where: { id: tripSpotId } });

        if (!tripSpot) {
            throw createError('Trip spot not found', 404);
        }

        Object.assign(tripSpot, updateData);
        return await this.tripSpotRepository.save(tripSpot);
    }

    async removeSpotFromTrip(tripSpotId: string) {
        const tripSpot = await this.tripSpotRepository.findOne({ where: { id: tripSpotId } });

        if (!tripSpot) {
            throw createError('Trip spot not found', 404);
        }

        await this.tripSpotRepository.remove(tripSpot);
        return { message: 'Spot removed from trip successfully' };
    }
}