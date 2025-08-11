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

export enum TripStatus {
    PLANNED = 'planned',
    ACTIVE = 'active',
    PAUSED = 'paused',
    COMPLETED = 'completed',
    CANCELLED = 'cancelled'
}

@Entity('trips')
export class Trip {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column()
    title!: string;

    @Column({type: 'text', nullable: true})
    description!: string;

    @Column({
        type: 'geography',
        spatialFeatureType: 'Point',
        srid: 4326,
    })
    start_location!: Point;

    @Column({
        type: 'geography',
        spatialFeatureType: 'Point',
        srid: 4326,
    })
    end_location!: Point;

    @Column()
    start_address!: string;

    @Column()
    end_address!: string;

    @Column({nullable: true})
    planned_start_date!: Date;

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
    estimated_distance!: number;

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
}