// src/entities/SpotReview.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './User';
import { Spot } from './Spot';
import { TransportMode } from '../enum/enums'; // Import from separate file

@Entity('spot_reviews')
export class SpotReview {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({
        type: 'enum',
        enum: TransportMode
    })
    transport_mode!: TransportMode;

    @Column({ type: 'int', width: 1 })
    safety_rating!: number; // 1-5

    @Column({ type: 'int', width: 1 })
    overall_rating!: number; // 1-5

    @Column({ type: 'int', width: 1 })
    effectiveness_rating!: number; // 1-5

    @Column({ type: 'int', nullable: true })
    wait_time_minutes!: number;

    @Column({ type: 'int', nullable: true })
    legal_status!: number;

    @Column({ type: 'int', nullable: true })
    facility_rating!: number;

    @Column({ type: 'int', nullable: true })
    accessibility_rating!: number;

    @Column({ type: 'text', nullable: true })
    comment!: string;

    @Column({ type: 'text', array: true, default: [] })
    photos!: string[];

    @Column({ default: 0 })
    helpful_votes!: number;

    @Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })
    review_latitude!: number;

    @Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })
    review_longitude!: number;

    @Column({ default: false })
    location_verified!: boolean;

    @Column({ type: 'decimal', precision: 5, scale: 1, nullable: true })
    distance_from_spot!: number;

    @Column({ type: 'json', nullable: true })
    context!: {
        weather?: string;
        time_of_day?: string;
        day_of_week?: string;
        season?: string;
        group_size?: number;
        user_experience_level?: string;
    };

    @CreateDateColumn()
    created_at!: Date;

    @Column()
    user_id!: string;

    @Column()
    spot_id!: string;

    // Relationships
    @ManyToOne(() => User, user => user.spot_reviews)
    @JoinColumn({ name: 'user_id' })
    user!: User;

    @ManyToOne(() => Spot, spot => spot.reviews)
    @JoinColumn({ name: 'spot_id' })
    spot!: Spot;
}