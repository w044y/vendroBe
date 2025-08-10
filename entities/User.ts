import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Spot } from './Spot';
import { SpotReview } from './SpotReview';
import { Trip } from './Trip';

@Entity('users')
export class User {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ unique: true })
    email!: string;

    @Column({ unique: true, nullable: true })
    username!: string;

    @Column({ nullable: true })
    display_name!: string;

    @Column({ nullable: true })
    profile_photo_url!: string;

    @Column({ type: 'text', nullable: true })
    bio!: string;

    @Column({ default: false })
    is_verified!: boolean;

    @Column({ type: 'decimal', precision: 2, scale: 1, default: 0 })
    safety_rating!: number;

    @Column({ default: 0 })
    vendro_points!: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    total_distance!: number;

    @Column({ type: 'text', array: true, default: [] })
    countries_visited!: string[];

    @Column({ default: 'en' })
    preferred_language!: string;

    @Column({ default: true })
    is_active!: boolean;

    @CreateDateColumn()
    created_at!: Date;

    @UpdateDateColumn()
    updated_at!: Date;

    // Relationships
    @OneToMany(() => Spot, spot => spot.created_by)
    created_spots!: Spot[];

    @OneToMany(() => SpotReview, review => review.user)
    spot_reviews!: SpotReview[];

    @OneToMany(() => Trip, trip => trip.user)
    trips!: Trip[];
}