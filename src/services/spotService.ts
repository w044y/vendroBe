import { AppDataSource } from '../config/database';
import { Spot } from '../entities/Spot';
import { SpotReview } from '../entities/SpotReview';
import { createError } from '../middleware/errorHandler';
import {User} from "../entities/User";
import {SpotType, TransportMode} from "../enum/enums";
import {UserProfileService} from "../services/userProfileService";

export class SpotService {
    private spotRepository = AppDataSource.getRepository(Spot);
    private reviewRepository = AppDataSource.getRepository(SpotReview);
    private userRepository = AppDataSource.getRepository(User);
    private userProfileService = new UserProfileService(); // Add this

    async getAllSpots(filters: {
        limit?: number;
        offset?: number;
        spot_type?: SpotType;
        is_verified?: boolean;
        min_rating?: number;
    } = {}) {
        const { limit = 50, offset = 0, spot_type, is_verified, min_rating } = filters;

        const query = this.spotRepository.createQueryBuilder('spot')
            .leftJoinAndSelect('spot.created_by', 'creator')
            .select([
                'spot.id', 'spot.name', 'spot.description', 'spot.latitude', 'spot.longitude',
                'spot.spot_type', 'spot.safety_rating', 'spot.overall_rating', 'spot.is_verified',
                'spot.photo_urls', 'spot.facilities', 'spot.created_at',
                'creator.id', 'creator.display_name', 'creator.username'
            ])
            .where('spot.is_active = :isActive', { isActive: true })
            .orderBy('spot.created_at', 'DESC')
            .take(limit)
            .skip(offset);

        if (spot_type) {
            query.andWhere('spot.spot_type = :spotType', { spotType: spot_type });
        }

        if (is_verified !== undefined) {
            query.andWhere('spot.is_verified = :isVerified', { isVerified: is_verified });
        }

        if (min_rating) {
            query.andWhere('spot.overall_rating >= :minRating', { minRating: min_rating });
        }

        return await query.getMany();
    }

    async getSpotById(id: string) {
        const spot = await this.spotRepository.findOne({
            where: { id, is_active: true },
            relations: ['created_by', 'reviews', 'reviews.user'],
            select: {
                created_by: { id: true, display_name: true, username: true, safety_rating: true },
                reviews: {
                    id: true, safety_rating: true, overall_rating: true, comment: true,
                    helpful_votes: true, created_at: true,
                    user: { id: true, display_name: true, username: true }
                }
            }
        });

        if (!spot) {
            throw createError('Spot not found', 404);
        }

        return spot;
    }

    async getNearbySpots(latitude: number, longitude: number, radiusKm: number = 10, limit: number = 20) {
        const radiusMeters = radiusKm * 1000;

        return await this.spotRepository
            .createQueryBuilder('spot')
            .leftJoinAndSelect('spot.created_by', 'creator')
            .select([
                'spot.id', 'spot.name', 'spot.description', 'spot.latitude', 'spot.longitude',
                'spot.spot_type', 'spot.safety_rating', 'spot.overall_rating', 'spot.is_verified',
                'spot.facilities', 'spot.tips',
                'creator.id', 'creator.display_name', 'creator.username'
            ])
            .where('spot.is_active = :isActive', { isActive: true })
            .andWhere('ST_DWithin(spot.location, ST_MakePoint(:lng, :lat)::geography, :radius)')
            .setParameters({ lng: longitude, lat: latitude, radius: radiusMeters })
            .orderBy('ST_Distance(spot.location, ST_MakePoint(:lng, :lat)::geography)')
            .setParameters({ lng: longitude, lat: latitude })
            .take(limit)
            .getMany();
    }

    async createSpot(spotData: {
        name: string;
        description: string;
        latitude: number;
        longitude: number;
        spot_type: SpotType;
        tips?: string;
        accessibility_info?: string;
        facilities?: string[];
        created_by_id: string;
    }) {

        await this.ensureDevUser();


        // Validate coordinates
        if (spotData.latitude < -90 || spotData.latitude > 90) {
            throw createError('Invalid latitude. Must be between -90 and 90', 400);
        }
        if (spotData.longitude < -180 || spotData.longitude > 180) {
            throw createError('Invalid longitude. Must be between -180 and 180', 400);
        }

        const spot = this.spotRepository.create({
            ...spotData,
            location: {
                type: 'Point',
                coordinates: [spotData.longitude, spotData.latitude]
            } as any
        });

        return await this.spotRepository.save(spot);
    }


    private async ensureDevUser() {
        const DEV_USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'; // Proper UUID format

        const devUser = await this.userRepository.findOne({
            where: { id: DEV_USER_ID }
        });

        if (!devUser) {
            const newDevUser = this.userRepository.create({
                id: DEV_USER_ID,
                email: 'dev@vendro.app',
                username: 'devuser',
                display_name: 'Dev User',
                vendro_points: 100,
                safety_rating: 4.5,
                is_verified: true,
            });
            await this.userRepository.save(newDevUser);
            console.log('✅ Created dev user with UUID:', DEV_USER_ID);
        }
    }



    async updateSpot(id: string, updateData: {
        name?: string;
        description?: string;
        tips?: string;
        accessibility_info?: string;
        facilities?: string[];
    }) {
        const spot = await this.getSpotById(id);
        Object.assign(spot, updateData);
        return await this.spotRepository.save(spot);
    }

    async deleteSpot(id: string) {
        const spot = await this.getSpotById(id);
        spot.is_active = false; // Soft delete
        await this.spotRepository.save(spot);
        return { message: 'Spot deleted successfully' };
    }

    // NEW: Get reviews filtered by transport mode
    async getSpotReviews(spotId: string, filters: {
        transport_mode?: TransportMode;
        limit?: number;
        offset?: number;
        sort_by?: 'newest' | 'oldest' | 'most_helpful';
    } = {}) {
        const { transport_mode, limit = 20, offset = 0, sort_by = 'newest' } = filters;

        const queryBuilder = this.reviewRepository.createQueryBuilder('review')
            .leftJoinAndSelect('review.user', 'user')
            .where('review.spot_id = :spotId', { spotId })
            .select([
                'review',
                'user.id',
                'user.display_name',
                'user.username',
                'user.safety_rating'
            ]);

        // Filter by transport mode if specified
        if (transport_mode) {
            queryBuilder.andWhere('review.transport_mode = :transport_mode', { transport_mode });
        }

        // Apply sorting
        switch (sort_by) {
            case 'oldest':
                queryBuilder.orderBy('review.created_at', 'ASC');
                break;
            case 'most_helpful':
                queryBuilder.orderBy('review.helpful_votes', 'DESC')
                    .addOrderBy('review.created_at', 'DESC');
                break;
            case 'newest':
            default:
                queryBuilder.orderBy('review.created_at', 'DESC');
                break;
        }

        return await queryBuilder
            .limit(limit)
            .offset(offset)
            .getMany();
    }



    private async updateSpotAggregatedRatings(spotId: string) {
        const spot = await this.spotRepository.findOne({
            where: {id: spotId},
            relations: ['reviews']
        });

        if (!spot) return;

        // Fix: Properly type the modeRatings object
        const modeRatings: Record<string, {
            safety: number;
            effectiveness: number;
            review_count: number;
            avg_wait_time?: number;
            legal_status?: number;
            facilities?: number;
            accessibility?: number;
        }> = {};

        const transportModes = Object.values(TransportMode);

        for (const mode of transportModes) {
            const modeReviews = spot.reviews.filter(review => review.transport_mode === mode);

            if (modeReviews.length > 0) {
                // Fix: Use string conversion to ensure proper indexing
                modeRatings[mode as string] = {
                    safety: this.calculateAverage(modeReviews.map(r => r.safety_rating)),
                    effectiveness: this.calculateAverage(modeReviews.map(r => r.effectiveness_rating)),
                    review_count: modeReviews.length,
                };

                // Add mode-specific metrics
                if (mode === TransportMode.HITCHHIKING) {
                    const waitTimes = modeReviews
                        .map(r => r.wait_time_minutes)
                        .filter(wt => wt !== null && wt !== undefined) as number[];
                    if (waitTimes.length > 0) {
                        modeRatings[mode as string].avg_wait_time = this.calculateAverage(waitTimes);
                    }
                }

                if (mode === TransportMode.VAN_LIFE) {
                    const legalStatuses = modeReviews
                        .map(r => r.legal_status)
                        .filter(ls => ls !== null && ls !== undefined) as number[];
                    if (legalStatuses.length > 0) {
                        modeRatings[mode as string].legal_status = this.calculateAverage(legalStatuses);
                    }
                }

                if (mode === TransportMode.CYCLING || mode === TransportMode.WALKING) {
                    const facilityRatings = modeReviews
                        .map(r => r.facility_rating)
                        .filter(fr => fr !== null && fr !== undefined) as number[];
                    if (facilityRatings.length > 0) {
                        modeRatings[mode as string].facilities = this.calculateAverage(facilityRatings);
                    }

                    const accessibilityRatings = modeReviews
                        .map(r => r.accessibility_rating)
                        .filter(ar => ar !== null && ar !== undefined) as number[];
                    if (accessibilityRatings.length > 0) {
                        modeRatings[mode as string].accessibility = this.calculateAverage(accessibilityRatings);
                    }
                }
            }
        }

    }

    private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371000; // Earth's radius in meters
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    private calculateAverage(numbers: number[]): number {
        if (numbers.length === 0) return 0;
        return Math.round((numbers.reduce((sum, num) => sum + num, 0) / numbers.length) * 10) / 10;
    }

    async addSpotReview(spotId: string, reviewData: {
        user_id: string;
        transport_mode: TransportMode;  // Make sure this is included
        safety_rating: number;
        effectiveness_rating: number;
        overall_rating: number;  // Add this - it was missing
        comment?: string;
        wait_time_minutes?: number;
        legal_status?: number;
        facility_rating?: number;
        accessibility_rating?: number;
        review_latitude?: number;
        review_longitude?: number;
        photos?: string[];  // Add this - it was missing
        context?: any;
    }) {
        // Validate ratings
        if (reviewData.safety_rating < 1 || reviewData.safety_rating > 5) {
            throw createError('Safety rating must be between 1 and 5', 400);
        }
        if (reviewData.overall_rating < 1 || reviewData.overall_rating > 5) {
            throw createError('Overall rating must be between 1 and 5', 400);
        }

        // Check if spot exists
        await this.getSpotById(spotId);

        // Check if user already reviewed this spot
        const existingReview = await this.reviewRepository.findOne({
            where: { spot_id: spotId, user_id: reviewData.user_id }
        });

        if (existingReview) {
            throw createError('You have already reviewed this spot', 409);
        }

        const review = this.reviewRepository.create({
            ...reviewData,
            spot_id: spotId
        });

        const savedReview = await this.reviewRepository.save(review);

        // Update spot ratings
        await this.updateSpotRatings(spotId);

        return savedReview;
    }

    private async updateSpotRatings(spotId: string) {
        const avgRatings = await this.reviewRepository
            .createQueryBuilder('review')
            .select('AVG(review.overall_rating)', 'avgOverall')
            .addSelect('AVG(review.safety_rating)', 'avgSafety')
            .where('review.spot_id = :spotId', { spotId })
            .getRawOne();

        await this.spotRepository.update(spotId, {
            overall_rating: parseFloat(avgRatings.avgOverall) || 0,
            safety_rating: parseFloat(avgRatings.avgSafety) || 0
        });
    }

    async getSpotsFiltered(filters: {
        transportModes?: TransportMode[];
        userId?: string; // Optional: filter based on user's profile
        latitude?: number;
        longitude?: number;
        radius?: number;
        limit?: number;
        offset?: number;
        spotType?: SpotType;
        minRating?: number;
        safetyPriority?: 'high' | 'medium' | 'low';
    } = {}) {
        const {
            transportModes,
            userId,
            latitude,
            longitude,
            radius = 10,
            limit = 50,
            offset = 0,
            spotType,
            minRating,
            safetyPriority
        } = filters;

        let effectiveTransportModes: TransportMode[] = [];

        // Determine which transport modes to filter by
        if (transportModes) {
            // Explicit transport modes provided
            effectiveTransportModes = transportModes;
        } else if (userId) {
            // Use user's profile preferences
            const userPrefs = await this.userProfileService.getUserFilterPreferences(userId);
            if (!userPrefs.showAllSpots) {
                effectiveTransportModes = userPrefs.travelModes;
            }
            // If showAllSpots is true, effectiveTransportModes stays empty (show all)
        }

        // Build the query
        let query = this.spotRepository.createQueryBuilder('spot')
            .leftJoinAndSelect('spot.created_by', 'creator')
            .select([
                'spot.id', 'spot.name', 'spot.description', 'spot.latitude', 'spot.longitude',
                'spot.spot_type', 'spot.safety_rating', 'spot.overall_rating', 'spot.is_verified',
                'spot.photo_urls', 'spot.facilities', 'spot.tips', 'spot.transport_modes',
                'spot.mode_ratings', 'spot.total_reviews', 'spot.last_reviewed', 'spot.created_at',
                'creator.id', 'creator.display_name', 'creator.username'
            ])
            .where('spot.is_active = :isActive', { isActive: true });

        // Apply transport mode filtering if specified
        if (effectiveTransportModes.length > 0) {
            // Filter spots that support at least one of the user's transport modes
            query = query.andWhere(
                'spot.transport_modes && :transportModes',
                { transportModes: effectiveTransportModes }
            );
        }

        // Apply location-based filtering
        if (latitude && longitude) {
            const radiusMeters = radius * 1000;
            query = query.andWhere(
                'ST_DWithin(spot.location, ST_MakePoint(:lng, :lat)::geography, :radius)'
            ).setParameters({ lng: longitude, lat: latitude, radius: radiusMeters });

            // Order by distance if location is provided
            query = query.orderBy('ST_Distance(spot.location, ST_MakePoint(:lng, :lat)::geography)');
        } else {
            // Default ordering by creation date if no location
            query = query.orderBy('spot.created_at', 'DESC');
        }

        // Apply additional filters
        if (spotType) {
            query = query.andWhere('spot.spot_type = :spotType', { spotType });
        }

        if (minRating) {
            query = query.andWhere('spot.overall_rating >= :minRating', { minRating });
        }

        // Apply safety-based filtering
        if (safetyPriority) {
            switch (safetyPriority) {
                case 'high':
                    query = query.andWhere('spot.safety_rating >= :minSafety', { minSafety: 4.0 });
                    break;
                case 'medium':
                    query = query.andWhere('spot.safety_rating >= :minSafety', { minSafety: 2.5 });
                    break;
                // 'low' doesn't add any safety filter
            }
        }

        // Apply pagination
        query = query.take(limit).skip(offset);

        const spots = await query.getMany();

        console.log(`🔍 Filtered spots query:
            - Transport modes: ${effectiveTransportModes.join(', ') || 'All'}
            - Location: ${latitude ? `${latitude}, ${longitude} (${radius}km)` : 'Any'}
            - Spot type: ${spotType || 'Any'}
            - Min rating: ${minRating || 'Any'}
            - Safety priority: ${safetyPriority || 'Any'}
            - Results: ${spots.length}/${limit}`);

        return spots;
    }

    // NEW: Get spots specifically for a user based on their profile
    async getSpotsForUser(userId: string, additionalFilters: {
        latitude?: number;
        longitude?: number;
        radius?: number;
        limit?: number;
        offset?: number;
    } = {}) {
        return this.getSpotsFiltered({
            ...additionalFilters,
            userId: userId
        });
    }

    // NEW: Get spots that are excellent for a specific transport mode
    async getSpotsByTransportModeQuality(transportMode: TransportMode, filters: {
        latitude?: number;
        longitude?: number;
        radius?: number;
        minEffectiveness?: number;
        limit?: number;
        offset?: number;
    } = {}) {
        const { minEffectiveness = 4.0, ...otherFilters } = filters;

        const spots = await this.getSpotsFiltered({
            ...otherFilters,
            transportModes: [transportMode]
        });

        // Filter by mode-specific effectiveness rating
        return spots.filter(spot => {
            const modeRating = spot.mode_ratings?.[transportMode];
            return modeRating && modeRating.effectiveness >= minEffectiveness;
        });
    }



}