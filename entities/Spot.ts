import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, Point } from 'typeorm';
import { User } from './User';
import { SpotReview } from './SpotReview';

export enum SpotType {
    HIGHWAY_ENTRANCE = 'highway_entrance',
    REST_STOP = 'rest_stop',
    GAS_STATION = 'gas_station',
    BRIDGE = 'bridge',
    ROUNDABOUT = 'roundabout',
    PARKING_LOT = 'parking_lot',
    OTHER = 'other'
}

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

    // PostGIS geometry point for efficient spatial queries
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

    @Column({ type: 'decimal', precision: 2, scale: 1, default: 0 })
    safety_rating!: number;

    @Column({ type: 'decimal', precision: 2, scale: 1, default: 0 })
    overall_rating!: number;

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

    @CreateDateColumn()
    created_at!: Date;

    @UpdateDateColumn()
    updated_at!: Date;

    // Relationships
    @ManyToOne(() => User, user => user.created_spots)
    created_by!: User;

    @OneToMany(() => SpotReview, review => review.spot)
    reviews!: SpotReview[];
}