import { AppDataSource } from '../config/database';
import {Trip, TripCollaborator, TripFork, TripPhase, TripPrivacyLevel, TripStatus} from '../entities/Trip';
import { TripSpot, TripSpotStatus } from '../entities/TripSpot';
import { createError } from '../middleware/errorHandler';
import {DailyUpdate, ExperienceSummary, RealityEntry} from "@/types/tripTypes";
import {CollaboratorRole} from "../entities/TripCollaborator";

export class TripService {
    private tripRepository = AppDataSource.getRepository(Trip);
    private tripSpotRepository = AppDataSource.getRepository(TripSpot);
    private forkRepository = AppDataSource.getRepository(TripFork); // ADD THIS LINE

    private collaboratorRepository = AppDataSource.getRepository(TripCollaborator);
    private generateId(): string {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
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

    // src/services/tripService.ts - Fix the create call
    // src/services/tripService.ts - Fixed createTrip method
    async createTrip(tripData: {
        title: string;
        description?: string;
        start_address?: string;
        end_address?: string;
        start_latitude?: number;
        start_longitude?: number;
        end_latitude?: number;
        end_longitude?: number;
        planned_start_date?: Date;
        estimated_distance?: number;
        travel_modes?: string[];
        tags?: string[];
        intention_notes?: string;
        trip_type?: 'planned' | 'spontaneous' | 'open_ended';
        region?: string;
        user_id: string;
    }) {
        // Validate coordinates only if provided
        if (tripData.start_latitude !== undefined && tripData.start_longitude !== undefined) {
            if (tripData.start_latitude < -90 || tripData.start_latitude > 90) {
                throw createError('Invalid start latitude. Must be between -90 and 90', 400);
            }
            if (tripData.start_longitude < -180 || tripData.start_longitude > 180) {
                throw createError('Invalid start longitude. Must be between -180 and 180', 400);
            }
        }

        if (tripData.end_latitude !== undefined && tripData.end_longitude !== undefined) {
            if (tripData.end_latitude < -90 || tripData.end_latitude > 90) {
                throw createError('Invalid end latitude. Must be between -90 and 90', 400);
            }
            if (tripData.end_longitude < -180 || tripData.end_longitude > 180) {
                throw createError('Invalid end longitude. Must be between -180 and 180', 400);
            }
        }

        // Create a new Trip instance directly
        const trip = new Trip();
        trip.title = tripData.title;
        trip.description = tripData.description || null;
        trip.start_address = tripData.start_address || null;
        trip.end_address = tripData.end_address || null;
        trip.start_location = (tripData.start_latitude !== undefined && tripData.start_longitude !== undefined) ? {
            type: 'Point',
            coordinates: [tripData.start_longitude, tripData.start_latitude]
        } as any : null;
        trip.end_location = (tripData.end_latitude !== undefined && tripData.end_longitude !== undefined) ? {
            type: 'Point',
            coordinates: [tripData.end_longitude, tripData.end_latitude]
        } as any : null;
        trip.planned_start_date = tripData.planned_start_date || null;
        trip.estimated_distance = tripData.estimated_distance || null;
        trip.travel_modes = tripData.travel_modes || ['hitchhiking'];
        trip.tags = tripData.tags || [];
        trip.intention_notes = tripData.intention_notes || null;
        trip.user_id = tripData.user_id;

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
    private async canUserEditTrip(tripId: string, userId: string): Promise<boolean> {
        const trip = await this.tripRepository.findOne({ where: { id: tripId } });
        if (!trip) return false;

        // Owner can always edit
        if (trip.user_id === userId) return true;

        // Check collaborator permissions
        const collaborator = await this.collaboratorRepository.findOne({
            where: { trip_id: tripId, user_id: userId }
        });

        return collaborator?.role === CollaboratorRole.EDITOR;
    }

    // src/services/tripService.ts - Verify method signature
    async addRealityEntry(
        tripId: string,
        userId: string,
        realityData: Omit<RealityEntry, 'id' | 'timestamp' | 'added_by'>
    ): Promise<Trip> {
        const trip = await this.getTripById(tripId);

        const canEdit = await this.canUserEditTrip(tripId, userId);
        if (!canEdit) {
            throw createError('No permission to edit this trip', 403);
        }

        if (trip.phase !== TripPhase.LIVE) {
            throw createError('Can only add reality entries during live phase', 400);
        }

        const realityEntry: RealityEntry = {
            ...realityData,
            id: this.generateId(),
            timestamp: new Date().toISOString(),
            added_by: userId
        };

        trip.reality_tracking.push(realityEntry);
        return await this.tripRepository.save(trip);
    }

    async addDailyUpdate(tripId: string, userId: string, updateData: Omit<DailyUpdate, 'id' | 'created_at' | 'updated_at'>): Promise<Trip> {
        const trip = await this.getTripById(tripId);

        const canEdit = await this.canUserEditTrip(tripId, userId);
        if (!canEdit) {
            throw createError('No permission to edit this trip', 403);
        }

        const dailyUpdate: DailyUpdate = {
            ...updateData,
            id: this.generateId(), // Use simple ID generator
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        trip.daily_updates.push(dailyUpdate);
        return await this.tripRepository.save(trip);
    }
// src/services/tripService.ts - Add missing voteOnTrip method
    async voteOnTrip(tripId: string, userId: string, isHelpful: boolean): Promise<void> {
        const trip = await this.getTripById(tripId);

        if (trip.privacy_level !== TripPrivacyLevel.PUBLIC_BLUEPRINT) {
            throw createError('Can only vote on public trips', 403);
        }

        // For now, just increment the helpful_votes counter
        // You can implement proper vote tracking later with TripVote entity
        if (isHelpful) {
            await this.tripRepository.increment({ id: tripId }, 'helpful_votes', 1);
        }
    }

// src/services/tripService.ts - Add missing browsePublicTrips method

    async browsePublicTrips(filters: {
        transport_modes?: string[];
        travel_style?:string
        region?: string;
        duration_days?: number;
        limit: number;
        offset: number;
    }): Promise<Trip[]> {
        let query = this.tripRepository.createQueryBuilder('trip')
            .leftJoinAndSelect('trip.user', 'user')
            .select([
                'trip.id', 'trip.title', 'trip.description',
                'trip.start_address', 'trip.end_address',
                'trip.travel_modes', 'trip.tags', 'trip.privacy_level', 'trip.phase',
                'trip.fork_count', 'trip.view_count', 'trip.helpful_votes',
                'trip.created_at', 'trip.reality_tracking',
                'user.id', 'user.display_name', 'user.username'
            ])
            .where('trip.privacy_level = :privacy', {
                privacy: TripPrivacyLevel.PUBLIC_BLUEPRINT
            })
            .andWhere('trip.phase = :phase', { phase: TripPhase.COMPLETED })
            .orderBy('trip.helpful_votes', 'DESC')
            .addOrderBy('trip.view_count', 'DESC')
            .take(filters.limit)
            .skip(filters.offset);

        if (filters.transport_modes?.length) {
            query = query.andWhere('trip.travel_modes && :modes', {
                modes: filters.transport_modes
            });
        }

        if (filters.region) {
            query = query.andWhere(
                'trip.start_address ILIKE :region OR trip.end_address ILIKE :region',
                { region: `%${filters.region}%` }
            );
        }

        const trips = await query.getMany();

        // Update view count for each trip (async, don't wait)
        trips.forEach(trip => {
            this.tripRepository.increment({ id: trip.id }, 'view_count', 1);
        });

        return trips;
    }
    async generateExperienceSummary(tripId: string): Promise<ExperienceSummary> {
        const trip = await this.getTripById(tripId);

        if (trip.phase !== TripPhase.COMPLETED) {
            throw createError('Can only generate summary for completed trips', 400);
        }

        const summary: ExperienceSummary = {
            total_days: trip.daily_updates.length,
            spots_visited: trip.reality_tracking.length,
            photos_taken: trip.reality_tracking.reduce((sum, entry) => sum + entry.photos.length, 0),
            must_see_spots: trip.reality_tracking
                .filter(entry => entry.worth_it_rating === 'must_see')
                .map(entry => ({
                    spot_name: entry.actual_location.name,
                    location: {
                        latitude: entry.actual_location.latitude,
                        longitude: entry.actual_location.longitude
                    },
                    why_must_see: entry.notes
                })),
            hidden_gems: trip.reality_tracking
                .filter(entry => entry.planned_vs_reality === 'spontaneous' && entry.experience_rating >= 4)
                .map(entry => ({
                    spot_name: entry.actual_location.name,
                    location: {
                        latitude: entry.actual_location.latitude,
                        longitude: entry.actual_location.longitude
                    },
                    discovery_story: entry.notes
                })),
            skip_these: trip.reality_tracking
                .filter(entry => entry.worth_it_rating === 'skip')
                .map(entry => ({
                    spot_name: entry.actual_location.name,
                    location: {
                        latitude: entry.actual_location.latitude,
                        longitude: entry.actual_location.longitude
                    },
                    why_skip: entry.wish_i_knew
                })),
            lessons_learned: trip.reality_tracking
                .map(entry => entry.wish_i_knew)
                .filter(lesson => lesson && lesson.length > 0),
            would_do_differently: trip.daily_updates
                .map(update => update.lessons_learned)
                .filter(lesson => lesson && lesson.length > 0) as string[],
            difficulty_rating: this.calculateDifficultyRating(trip),
            solo_friendly: this.assessSoloFriendliness(trip),
            group_friendly: this.assessGroupFriendliness(trip),
            best_for: this.determineBestFor(trip),
            one_line_summary: `${trip.daily_updates.length}-day journey from ${trip.start_address} to ${trip.end_address}`,
            highlight_story: this.extractHighlightStory(trip.daily_updates),
            created_at: new Date().toISOString()
        };

        trip.experience_summary = summary;
        await this.tripRepository.save(trip);

        return summary;
    }

    private calculateDifficultyRating(trip: Trip): 1 | 2 | 3 | 4 | 5 {
        // Business logic to calculate difficulty based on reality entries
        const avgMoodRating = trip.daily_updates.reduce((sum, update) => sum + update.mood_rating, 0) / trip.daily_updates.length;

        if (avgMoodRating >= 4.5) return 1; // Very easy
        if (avgMoodRating >= 3.5) return 2; // Easy
        if (avgMoodRating >= 2.5) return 3; // Moderate
        if (avgMoodRating >= 1.5) return 4; // Hard
        return 5; // Very hard
    }

    private assessSoloFriendliness(trip: Trip): boolean {
        // Business logic to assess if trip is solo-friendly
        return trip.reality_tracking.some(entry =>
            entry.notes.toLowerCase().includes('solo') ||
            entry.notes.toLowerCase().includes('alone')
        );
    }

    private assessGroupFriendliness(trip: Trip): boolean {
        // Business logic to assess if trip is group-friendly
        return trip.daily_updates.some(update =>
            update.accommodation.type === 'hostel' ||
            update.highlight.toLowerCase().includes('group')
        );
    }

    private determineBestFor(trip: Trip): string[] {
        const tags: string[] = [];

        if (trip.reality_tracking.length > 10) tags.push('experienced travelers');
        if (trip.daily_updates.some(u => u.energy_level <= 2)) tags.push('budget travelers');
        if (trip.travel_modes.includes('hitchhiking')) tags.push('adventure seekers');

        return tags;
    }

    private extractHighlightStory(dailyUpdates: DailyUpdate[]): string {
        const bestDay = dailyUpdates.reduce((best, current) =>
            current.mood_rating > best.mood_rating ? current : best
        );

        return bestDay?.highlight || 'An amazing journey full of discoveries';
    }

    // src/services/tripService.ts - Simplified version without fork tracking
    async forkTrip(originalTripId: string, userId: string): Promise<Trip> {
        const originalTrip = await this.getTripById(originalTripId);

        if (originalTrip.privacy_level === TripPrivacyLevel.PRIVATE_DRAFT) {
            throw createError('This trip cannot be forked', 403);
        }

        const forkedTrip = this.tripRepository.create({
            title: `${originalTrip.title} (Forked)`,
            description: originalTrip.description,
            start_location: originalTrip.start_location,
            end_location: originalTrip.end_location,
            start_address: originalTrip.start_address,
            end_address: originalTrip.end_address,
            travel_modes: originalTrip.travel_modes,
            estimated_distance: originalTrip.estimated_distance,
            // New trip settings
            privacy_level: TripPrivacyLevel.PRIVATE_DRAFT,
            phase: TripPhase.PLANNING,
            status: TripStatus.PLANNED,
            forked_from: originalTripId,
            user_id: userId,
            is_public: false,
            // Initialize counters
            fork_count: 0,
            view_count: 0,
            helpful_votes: 0
        });

        const savedTrip = await this.tripRepository.save(forkedTrip);

        // Update fork count on original (simple increment)
        await this.tripRepository.increment({ id: originalTripId }, 'fork_count', 1);

        return savedTrip;
    }
}