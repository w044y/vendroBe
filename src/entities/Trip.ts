import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    OneToMany,
    Point,
    JoinColumn
} from 'typeorm';
import { User } from './User';
import { TripSpot } from './TripSpot';
import { RealityEntry, DailyUpdate, ExperienceSummary } from '../types/tripTypes';

export enum TripStatus {
    PLANNED = 'planned',
    ACTIVE = 'active',
    PAUSED = 'paused',
    COMPLETED = 'completed',
    CANCELLED = 'cancelled'
}
export enum TripPrivacyLevel {
    PRIVATE_DRAFT = 'private_draft',
    SHARED_WITH_FRIENDS = 'shared_with_friends',
    COMMUNITY_PREVIEW = 'community_preview',
    PUBLIC_BLUEPRINT = 'public_blueprint'
}

// NEW: Add trip phases
export enum TripPhase {
    PLANNING = 'planning',
    LIVE = 'live',
    COMPLETED = 'completed'
}

@Entity('trips')
export class Trip {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column()
    title!: string;

    @Column({type: 'text', nullable: true})
    description!: string | null;


    @Column({
        type: 'geography',
        spatialFeatureType: 'Point',
        srid: 4326,
        nullable: true  // ADD nullable: true
    })
    start_location!: Point | null;

    @Column({
        type: 'geography',
        spatialFeatureType: 'Point',
        srid: 4326,
        nullable: true  // ADD nullable: true
    })
    end_location!: Point | null;

    @Column({ nullable: true })  // ADD nullable: true
    start_address!: string | null;

    @Column({ nullable: true })  // ADD nullable: true
    end_address!: string | null;

    @Column({nullable: true})
    planned_start_date!: Date | null;

    @Column({nullable: true})
    actual_start_date!: Date;

    @Column({nullable: true})
    planned_end_date!: Date;

    @Column({nullable: true})
    actual_end_date!: Date;

    @Column({
        type: 'enum',
        enum: TripStatus,
        default: TripStatus.PLANNED
    })
    status!: TripStatus;

    @Column({default: true})
    is_public!: boolean;

    @Column({type: 'decimal', precision: 10, scale: 2, nullable: true})
    estimated_distance!: number | null;

    @Column({type: 'decimal', precision: 10, scale: 2, nullable: true})
    actual_distance!: number;

    @Column({type: 'decimal', precision: 8, scale: 2, default: 0})
    carbon_saved!: number;

    @Column({type: 'json', nullable: true})
    route_polyline!: object;

    @Column({type: 'text', array: true, default: []})
    travel_modes!: string[];

    @Column({type: 'json', nullable: true})
    weather_conditions!: object;

    @Column({default: 0})
    total_rides!: number;

    @Column({type: 'decimal', precision: 5, scale: 2, nullable: true})
    average_wait_time!: number;

    @Column({type: 'text', array: true, default: []})
    countries_visited!: string[];

    @Column({type: 'text', array: true, default: []})
    cities_visited!: string[];

    @Column({type: 'json', nullable: true})
    emergency_contacts!: object;

    @Column({type: 'text', nullable: true})
    notes!: string;

    @Column({type: 'text', array: true, default: []})
    tags!: string[];

    // ADD THIS FOREIGN KEY COLUMN
    @Column()
    user_id!: string;

    @CreateDateColumn()
    created_at!: Date;

    @UpdateDateColumn()
    updated_at!: Date;

    // Relationships
    @ManyToOne(() => User, user => user.trips)
    @JoinColumn({name: 'user_id'})
    user!: User;

    @OneToMany(() => TripSpot, tripSpot => tripSpot.trip)
    trip_spots!: TripSpot[];
    @Column({
        type: 'enum',
        enum: TripPrivacyLevel,
        default: TripPrivacyLevel.PRIVATE_DRAFT
    })
    privacy_level!: TripPrivacyLevel;

    @Column({
        type: 'enum',
        enum: TripPhase,
        default: TripPhase.PLANNING
    })
    phase!: TripPhase;

    @Column({ type: 'text', nullable: true })
    intention_notes!: string | null;

    @Column({ type: 'json', default: [] })
    research_notes!: string[];

    @Column({ type: 'text', array: true, default: [] })
    dream_spots!: string[];

    @Column({ type: 'text', array: true, default: [] })
    confirmed_spots!: string[];

    @Column({ type: 'json', default: [] })
    reality_tracking!: RealityEntry[];

    @Column({ type: 'json', default: [] })
    daily_updates!: DailyUpdate[];

    @Column({ type: 'json', nullable: true })
    experience_summary!: ExperienceSummary;

    @Column({ nullable: true })
    forked_from!: string;

    @Column({ default: 0 })
    fork_count!: number;

    @Column({ default: 0 })
    view_count!: number;

    @Column({ default: 0 })
    helpful_votes!: number;
}

// New entities for social features
@Entity('trip_collaborators')
export class TripCollaborator {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column()
    trip_id!: string;

    @Column()
    user_id!: string;

    @Column({
        type: 'enum',
        enum: ['owner', 'editor', 'viewer'],
        default: 'viewer'
    })
    role!: string;

    @Column({ default: true })
    can_add_photos!: boolean;

    @Column({ default: false })
    can_edit_route!: boolean;
}

@Entity('trip_forks')
export class TripFork {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column()
    original_trip_id!: string;

    @Column()
    forked_trip_id!: string;

    @Column()
    forked_by_user_id!: string;

    @CreateDateColumn()
    forked_at!: Date;

}