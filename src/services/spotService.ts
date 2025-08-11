import { AppDataSource } from '../config/database';
import { Spot, SpotType } from '../entities/Spot';
import { SpotReview } from '../entities/SpotReview';
import { createError } from '../middleware/errorHandler';

export class SpotService {
    private spotRepository = AppDataSource.getRepository(Spot);
    private reviewRepository = AppDataSource.getRepository(SpotReview);

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

    async addSpotReview(spotId: string, reviewData: {
        user_id: string;
        safety_rating: number;
        overall_rating: number;
        comment?: string;
        photos?: string[];
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
}