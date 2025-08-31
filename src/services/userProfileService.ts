// src/services/userProfileService.ts - Complete service with both phases
import { AppDataSource } from '../config/database';
import { UserProfile, ExperienceLevel, SafetyPriority } from '../entities/UserProfile';
import { User } from '../entities/User';
import { UserBadge, BadgeCategory } from '../entities/UserBadge';
import { TrustVerification, VerificationType } from '../entities/TrustVerification';
import { SpotReview } from '../entities/SpotReview';
import { Spot } from '../entities/Spot';
import { createError } from '../middleware/errorHandler';
import { TransportMode } from '../enum/enums';

export class UserProfileService {
    private userProfileRepository = AppDataSource.getRepository(UserProfile);
    private userRepository = AppDataSource.getRepository(User);
    private userBadgeRepository = AppDataSource.getRepository(UserBadge);
    private trustVerificationRepository = AppDataSource.getRepository(TrustVerification);
    private spotReviewRepository = AppDataSource.getRepository(SpotReview);
    private spotRepository = AppDataSource.getRepository(Spot);

    // PHASE 1 & 2: Get complete user profile
    async getCompleteUserProfile(userId: string) {
        const profile = await this.userProfileRepository.findOne({
            where: { user_id: userId },
            relations: ['user', 'badges', 'verifications']
        });

        if (!profile) {
            throw createError('Profile not found', 404);
        }

        // Calculate trust score
        const trustScore = await this.calculateTrustScore(userId);

        // Get recent badges (Phase 2)
        const recentBadges = await this.userBadgeRepository.find({
            where: { user_id: userId },
            order: { earned_at: 'DESC' },
            take: 10
        });

        // Get badge counts by category
        const badgeCounts = await this.getBadgeCounts(userId);

        return {
            profile,
            trustScore,
            badges: recentBadges,
            badgeCounts,
            memberSince: profile.created_at,
            isNewMember: this.isNewMember(profile.created_at)
        };
    }

    // PHASE 1: Calculate trust score (0-100)
    async calculateTrustScore(userId: string): Promise<number> {
        const profile = await this.userProfileRepository.findOne({
            where: { user_id: userId }
        });

        if (!profile) return 0;

        let score = 0;

        // Base verification points (40 points total)
        if (profile.email_verified) score += 15;
        if (profile.phone_verified) score += 15;
        if (profile.social_connected) score += 10;

        // Community engagement (40 points total)
        const reviewScore = Math.min(profile.helpful_reviews * 2, 20); // Max 20
        const contributionScore = Math.min(profile.spots_added * 3, 15); // Max 15
        const qualityScore = Math.min(profile.reviewer_rating * 2, 10); // Max 10 (5-star rating * 2)

        score += reviewScore + contributionScore + qualityScore;

        // Time-based trust (20 points total)
        const membershipDays = Math.floor((Date.now() - profile.created_at.getTime()) / (1000 * 60 * 60 * 24));
        const timeScore = Math.min(membershipDays / 30, 10); // Max 10 points for 10 months+

        // Community vouches
        const vouchScore = Math.min(profile.community_vouches * 2, 10); // Max 10

        score += timeScore + vouchScore;

        return Math.min(Math.round(score), 100);
    }

    // PHASE 1: Update profile statistics (called after reviews/spots)
    async updateProfileStats(userId: string): Promise<void> {
        const profile = await this.userProfileRepository.findOne({
            where: { user_id: userId }
        });

        if (!profile) return;

        // Count reviews and helpful reviews
        const reviews = await this.spotReviewRepository.find({
            where: { user_id: userId }
        });

        const helpfulReviews = reviews.filter(r => r.helpful_votes >= 3);
        const totalHelpfulVotes = reviews.reduce((sum, r) => sum + r.helpful_votes, 0);
        const avgHelpfulness = reviews.length > 0 ? totalHelpfulVotes / reviews.length : 0;

        // Count spots
        const spotsCount = await this.spotRepository.count({
            where: { created_by_id: userId }
        });

        const verifiedSpotsCount = await this.spotRepository.count({
            where: { created_by_id: userId, is_verified: true }
        });

        // Update profile
        profile.total_reviews = reviews.length;
        profile.helpful_reviews = helpfulReviews.length;
        profile.reviewer_rating = Math.min(avgHelpfulness / 2, 5); // Scale to 0-5
        profile.spots_added = spotsCount;
        profile.verified_spots = verifiedSpotsCount;

        await this.userProfileRepository.save(profile);

        // Check for new badges
        await this.checkAndAwardBadges(userId);
    }

    // PHASE 2: Update extended profile (bio, languages, countries)
    async updateExtendedProfile(userId: string, updates: {
        bio?: string;
        languages?: string[];
        countriesVisited?: string[];
        publicProfile?: boolean;
        showStats?: boolean;
    }) {
        const profile = await this.userProfileRepository.findOne({
            where: { user_id: userId }
        });

        if (!profile) {
            throw createError('Profile not found', 404);
        }

        // Update fields
        if (updates.bio !== undefined) profile.bio = updates.bio;
        if (updates.languages !== undefined) profile.languages = updates.languages;
        if (updates.countriesVisited !== undefined) profile.countries_visited = updates.countriesVisited;
        if (updates.publicProfile !== undefined) profile.public_profile = updates.publicProfile;
        if (updates.showStats !== undefined) profile.show_stats = updates.showStats;

        await this.userProfileRepository.save(profile);

        // Check for explorer badges
        await this.checkExplorerBadges(userId);

        return profile;
    }

    // PHASE 1 & 2: Badge awarding system
    async checkAndAwardBadges(userId: string): Promise<void> {
        await this.checkTrustBadges(userId);
        await this.checkReviewerBadges(userId);
        await this.checkContributorBadges(userId);
        await this.checkExplorerBadges(userId);
        await this.checkCommunityBadges(userId);
    }

    private async checkTrustBadges(userId: string): Promise<void> {
        const profile = await this.userProfileRepository.findOne({
            where: { user_id: userId }
        });

        if (!profile) return;

        // Email verification badge
        if (profile.email_verified) {
            await this.awardBadge(userId, {
                key: 'email_verified',
                name: 'Email Verified',
                description: 'Verified their email address',
                emoji: '✅',
                category: BadgeCategory.TRUST,
                sortOrder: 1
            });
        }

        // Phone verification badge
        if (profile.phone_verified) {
            await this.awardBadge(userId, {
                key: 'phone_verified',
                name: 'Phone Verified',
                description: 'Verified their phone number',
                emoji: '📱',
                category: BadgeCategory.TRUST,
                sortOrder: 2
            });
        }

        // Social connection badge
        if (profile.social_connected) {
            await this.awardBadge(userId, {
                key: 'social_connected',
                name: 'Social Connected',
                description: 'Connected social media account',
                emoji: '🔗',
                category: BadgeCategory.TRUST,
                sortOrder: 3
            });
        }
    }

    private async checkReviewerBadges(userId: string): Promise<void> {
        const profile = await this.userProfileRepository.findOne({
            where: { user_id: userId }
        });

        if (!profile) return;

        const badges = [
            { threshold: 1, key: 'first_reviewer', name: 'First Reviewer', level: null, emoji: '📝', sortOrder: 10 },
            { threshold: 5, key: 'helpful_reviewer_bronze', name: 'Helpful Reviewer', level: 'bronze', emoji: '⭐', sortOrder: 11 },
            { threshold: 15, key: 'helpful_reviewer_silver', name: 'Trusted Reviewer', level: 'silver', emoji: '🌟', sortOrder: 12 },
            { threshold: 50, key: 'helpful_reviewer_gold', name: 'Expert Reviewer', level: 'gold', emoji: '✨', sortOrder: 13 },
        ];

        for (const badge of badges) {
            if (profile.helpful_reviews >= badge.threshold) {
                await this.awardBadge(userId, {
                    key: badge.key,
                    name: badge.name,
                    description: `Left ${badge.threshold}+ helpful reviews`,
                    emoji: badge.emoji,
                    category: BadgeCategory.REVIEWER,
                    level: badge.level,
                    sortOrder: badge.sortOrder
                });
            }
        }
    }

    private async checkContributorBadges(userId: string): Promise<void> {
        const profile = await this.userProfileRepository.findOne({
            where: { user_id: userId }
        });

        if (!profile) return;

        const badges = [
            { threshold: 1, key: 'first_spot', name: 'Spot Spotter', level: null, emoji: '📍', sortOrder: 20 },
            { threshold: 5, key: 'spot_contributor_bronze', name: 'Spot Contributor', level: 'bronze', emoji: '🗺️', sortOrder: 21 },
            { threshold: 15, key: 'spot_contributor_silver', name: 'Map Builder', level: 'silver', emoji: '🌍', sortOrder: 22 },
            { threshold: 50, key: 'spot_contributor_gold', name: 'Map Expert', level: 'gold', emoji: '🎯', sortOrder: 23 },
        ];

        for (const badge of badges) {
            if (profile.spots_added >= badge.threshold) {
                await this.awardBadge(userId, {
                    key: badge.key,
                    name: badge.name,
                    description: `Added ${badge.threshold}+ spots to the map`,
                    emoji: badge.emoji,
                    category: BadgeCategory.CONTRIBUTOR,
                    level: badge.level,
                    sortOrder: badge.sortOrder
                });
            }
        }

        // Verified spots badge
        if (profile.verified_spots >= 3) {
            await this.awardBadge(userId, {
                key: 'verified_contributor',
                name: 'Verified Contributor',
                description: 'Added 3+ community-verified spots',
                emoji: '✅',
                category: BadgeCategory.CONTRIBUTOR,
                level: 'gold',
                sortOrder: 24
            });
        }
    }

    private async checkExplorerBadges(userId: string): Promise<void> {
        const profile = await this.userProfileRepository.findOne({
            where: { user_id: userId }
        });

        if (!profile) return;

        // Country explorer badges
        const countryCount = profile.countries_visited.length;
        const countryBadges = [
            { threshold: 3, key: 'country_explorer_bronze', name: 'Country Explorer', level: 'bronze', emoji: '🌍', sortOrder: 30 },
            { threshold: 10, key: 'country_explorer_silver', name: 'World Traveler', level: 'silver', emoji: '🌎', sortOrder: 31 },
            { threshold: 25, key: 'country_explorer_gold', name: 'Globe Trotter', level: 'gold', emoji: '🌏', sortOrder: 32 },
        ];

        for (const badge of countryBadges) {
            if (countryCount >= badge.threshold) {
                await this.awardBadge(userId, {
                    key: badge.key,
                    name: badge.name,
                    description: `Visited ${badge.threshold}+ countries`,
                    emoji: badge.emoji,
                    category: BadgeCategory.EXPLORER,
                    level: badge.level,
                    sortOrder: badge.sortOrder
                });
            }
        }

        // Multi-modal badge
        const modeCount = profile.travel_modes.length;
        if (modeCount >= 3) {
            await this.awardBadge(userId, {
                key: 'multimodal_master',
                name: 'Multi-Modal Master',
                description: 'Uses 3+ different transport modes',
                emoji: '🚀',
                category: BadgeCategory.EXPLORER,
                level: 'silver',
                sortOrder: 33
            });
        }

        // Language badges
        const languageCount = profile.languages.length;
        if (languageCount >= 3) {
            await this.awardBadge(userId, {
                key: 'polyglot',
                name: 'Polyglot',
                description: 'Speaks 3+ languages',
                emoji: '🗣️',
                category: BadgeCategory.EXPLORER,
                level: 'silver',
                sortOrder: 34
            });
        }
    }

    private async checkCommunityBadges(userId: string): Promise<void> {
        const profile = await this.userProfileRepository.findOne({
            where: { user_id: userId }
        });

        if (!profile) return;

        // Long-time member badges
        const membershipDays = Math.floor((Date.now() - profile.created_at.getTime()) / (1000 * 60 * 60 * 24));

        if (membershipDays >= 365) { // 1 year
            await this.awardBadge(userId, {
                key: 'veteran_member',
                name: 'Veteran Member',
                description: 'Member for over 1 year',
                emoji: '🏆',
                category: BadgeCategory.COMMUNITY,
                sortOrder: 40
            });
        }

        // Community vouches badge
        if (profile.community_vouches >= 5) {
            await this.awardBadge(userId, {
                key: 'trusted_by_community',
                name: 'Trusted by Community',
                description: 'Received 5+ community vouches',
                emoji: '🤝',
                category: BadgeCategory.COMMUNITY,
                level: 'gold',
                sortOrder: 41
            });
        }
    }

    private async awardBadge(userId: string, badgeData: {
        key: string;
        name: string;
        description: string;
        emoji: string;
        category: BadgeCategory;
        level?: string | null;
        sortOrder: number;
    }): Promise<void> {
        const existingBadge = await this.userBadgeRepository.findOne({
            where: { user_id: userId, badge_key: badgeData.key }
        });

        if (!existingBadge) {
            const badge = this.userBadgeRepository.create({
                user_id: userId,
                badge_key: badgeData.key,
                name: badgeData.name,
                description: badgeData.description,
                emoji: badgeData.emoji,
                category: badgeData.category,
                level: badgeData.level,
                sort_order: badgeData.sortOrder
            });

            await this.userBadgeRepository.save(badge);
            console.log(`🏆 Badge awarded: ${badgeData.name} to user ${userId}`);
        }
    }

    private async getBadgeCounts(userId: string) {
        const badges = await this.userBadgeRepository.find({
            where: { user_id: userId }
        });

        return {
            total: badges.length,
            trust: badges.filter(b => b.category === BadgeCategory.TRUST).length,
            reviewer: badges.filter(b => b.category === BadgeCategory.REVIEWER).length,
            contributor: badges.filter(b => b.category === BadgeCategory.CONTRIBUTOR).length,
            explorer: badges.filter(b => b.category === BadgeCategory.EXPLORER).length,
            community: badges.filter(b => b.category === BadgeCategory.COMMUNITY).length,
            gold: badges.filter(b => b.level === 'gold').length,
            silver: badges.filter(b => b.level === 'silver').length,
            bronze: badges.filter(b => b.level === 'bronze').length
        };
    }

    private isNewMember(createdAt: Date): boolean {
        const daysSinceJoining = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
        return daysSinceJoining < 30; // New if less than 30 days
    }

    // Verification methods
    async addVerification(userId: string, type: VerificationType, metadata?: any): Promise<void> {
        const verification = this.trustVerificationRepository.create({
            user_id: userId,
            type,
            verified: true,
            metadata
        });

        await this.trustVerificationRepository.save(verification);

        // Update profile verification flags
        const profile = await this.userProfileRepository.findOne({
            where: { user_id: userId }
        });

        if (profile) {
            switch (type) {
                case VerificationType.EMAIL:
                    profile.email_verified = true;
                    break;
                case VerificationType.PHONE:
                    profile.phone_verified = true;
                    break;
                case VerificationType.SOCIAL_FACEBOOK:
                case VerificationType.SOCIAL_GOOGLE:
                    profile.social_connected = true;
                    break;
                case VerificationType.COMMUNITY_VOUCH:
                    profile.community_vouches += 1;
                    break;
            }

            await this.userProfileRepository.save(profile);
            await this.checkTrustBadges(userId);
        }
    }
}