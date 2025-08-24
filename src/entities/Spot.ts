// src/entities/Spot.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, Point, JoinColumn } from 'typeorm';
import { User } from './User';
import { SpotReview } from './SpotReview';
import { SpotType } from "../enum/enums"; // Import from separate file
import {TransportMode} from "../enum/enums";

@Entity('spots')
export class Spot {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column()
    name!: string;

    @Column({ type: 'text' })
    description!: string;

    @Column({ type: 'decimal', precision: 10, scale: 8 })
    latitude!: number;

    @Column({ type: 'decimal', precision: 11, scale: 8 })
    longitude!: number;

    @Column({
        type: 'geography',
        spatialFeatureType: 'Point',
        srid: 4326,
    })
    location!: Point;

    @Column({
        type: 'enum',
        enum: SpotType,
        default: SpotType.OTHER
    })
    spot_type!: SpotType;

    @Column({ type: 'text', array: true, default: [] })
    transport_modes!: TransportMode[];

    @Column({ type: 'decimal', precision: 2, scale: 1, default: 0 })
    safety_rating!: number;

    @Column({ type: 'decimal', precision: 2, scale: 1, default: 0 })
    overall_rating!: number;

    @Column({ type: 'json', nullable: true })
    mode_ratings!: {
        hitchhiking?: {
            safety: number;
            effectiveness: number;
            avg_wait_time: number;
            review_count: number;
        };
        cycling?: {
            safety: number;
            effectiveness: number;
            facilities: number;
            review_count: number;
        };
        van_life?: {
            safety: number;
            effectiveness: number;
            legal_status: number;
            review_count: number;
        };
        walking?: {
            safety: number;
            effectiveness: number;
            accessibility: number;
            review_count: number;
        };
    };

    @Column({ type: 'int', default: 0 })
    total_reviews!: number;

    @Column({ nullable: true })
    last_reviewed!: Date;

    @Column({ default: false })
    is_verified!: boolean;

    @Column({ nullable: true })
    verification_date!: Date;

    @Column({ type: 'text', array: true, default: [] })
    photo_urls!: string[];

    @Column({ type: 'text', nullable: true })
    tips!: string;

    @Column({ type: 'text', nullable: true })
    accessibility_info!: string;

    @Column({ type: 'text', array: true, default: [] })
    facilities!: string[];

    @Column({ default: true })
    is_active!: boolean;

    @Column()
    created_by_id!: string;

    @CreateDateColumn()
    created_at!: Date;

    @UpdateDateColumn()
    updated_at!: Date;

    // Relationships
    @ManyToOne(() => User, user => user.created_spots)
    @JoinColumn({ name: 'created_by_id' })
    created_by!: User;

    @OneToMany(() => SpotReview, review => review.spot)
    reviews!: SpotReview[];
}