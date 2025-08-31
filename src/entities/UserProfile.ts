// src/entities/UserProfile.ts - Complete version with both phases
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToOne, OneToMany, JoinColumn } from 'typeorm';
import { User } from './User';
import { SpotReview } from './SpotReview';
import { UserBadge } from './UserBadge';
import { TrustVerification } from './TrustVerification';
import { TransportMode } from '../enum/enums';

export enum ExperienceLevel {
    BEGINNER = 'beginner',
    INTERMEDIATE = 'intermediate',
    EXPERT = 'expert'
}

export enum SafetyPriority {
    HIGH = 'high',
    MEDIUM = 'medium',
    LOW = 'low'
}

@Entity('user_profiles')
export class UserProfile {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column()
    user_id!: string;

    // PHASE 1: Trust & Credibility
    @Column({
        type: 'simple-array',
        transformer: {
            to: (value: TransportMode[]) => value.join(','),
            from: (value: string) => value ? value.split(',') as TransportMode[] : []
        }
    })
    travel_modes!: TransportMode[];

    @Column({
        type: 'enum',
        enum: TransportMode
    })
    primary_mode!: TransportMode;

    @Column({
        type: 'enum',
        enum: ExperienceLevel,
        default: ExperienceLevel.BEGINNER
    })
    experience_level!: ExperienceLevel;

    @Column({
        type: 'enum',
        enum: SafetyPriority,
        default: SafetyPriority.HIGH
    })
    safety_priority!: SafetyPriority;

    // Trust indicators
    @Column({ default: false })
    email_verified!: boolean;

    @Column({ default: false })
    phone_verified!: boolean;

    @Column({ default: false })
    social_connected!: boolean;

    @Column({ type: 'int', default: 0 })
    community_vouches!: number;

    // Community stats (calculated fields)
    @Column({ type: 'int', default: 0 })
    total_reviews!: number;

    @Column({ type: 'int', default: 0 })
    helpful_reviews!: number;

    @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
    reviewer_rating!: number; // 0-5 based on helpfulness of reviews

    @Column({ type: 'int', default: 0 })
    spots_added!: number;

    @Column({ type: 'int', default: 0 })
    verified_spots!: number;

    // PHASE 2: Personality & Gamification
    @Column({ type: 'text', nullable: true })
    bio!: string;

    @Column({ type: 'text', array: true, default: [] })
    languages!: string[]; // ['en', 'es', 'fr']

    @Column({ type: 'text', array: true, default: [] })
    countries_visited!: string[]; // ['US', 'ES', 'FR']

    // Settings
    @Column({ default: false })
    show_all_spots!: boolean;

    @Column({ default: true })
    public_profile!: boolean;

    @Column({ default: true })
    show_stats!: boolean;

    // Meta
    @Column({ default: false })
    onboarding_completed!: boolean;

    @CreateDateColumn()
    created_at!: Date;

    @UpdateDateColumn()
    updated_at!: Date;

    // Relationships
    @OneToOne(() => User, user => user.profile)
    @JoinColumn({ name: 'user_id' })
    user!: User;

    @OneToMany(() => SpotReview, review => review.user)
    reviews!: SpotReview[];

    @OneToMany(() => UserBadge, badge => badge.user)
    badges!: UserBadge[];

    @OneToMany(() => TrustVerification, verification => verification.user)
    verifications!: TrustVerification[];
}