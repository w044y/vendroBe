import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, Point } from 'typeorm';
import { User } from './User';
import { TripSpot } from './TripSpot';

export enum TripStatus {
    PLANNED = 'planned',      // ! Trip is being planned but not started yet
    ACTIVE = 'active',        // ! Currently in progress - user is traveling
    PAUSED = 'paused',        // ! Temporarily stopped (overnight, break, etc.)
    COMPLETED = 'completed',  // ! Successfully finished the trip
    CANCELLED = 'cancelled'   // ! Trip was cancelled before or during travel
}

@Entity('trips')
export class Trip {
    @PrimaryGeneratedColumn('uuid')
    id!: string; // ! Unique identifier for each trip

    @Column()
    title!: string; // ! User-friendly name like "Berlin to Prague Adventure"

    @Column({ type: 'text', nullable: true })
    description!: string; // ! Optional detailed description of the trip purpose/story

    @Column({
        type: 'geography',
        spatialFeatureType: 'Point',
        srid: 4326,
    })
    start_location!: Point; // ! PostGIS point for efficient geospatial queries on start location

    @Column({
        type: 'geography',
        spatialFeatureType: 'Point',
        srid: 4326,
    })
    end_location!: Point; // ! PostGIS point for efficient geospatial queries on destination

    @Column()
    start_address!: string; // ! Human-readable start address like "Berlin Central Station"

    @Column()
    end_address!: string; // ! Human-readable destination address like "Prague Old Town"

    @Column({ nullable: true })
    planned_start_date!: Date; // ! When user plans to start (can be future date)

    @Column({ nullable: true })
    actual_start_date!: Date; // ! When trip actually began (set when status changes to active)

    @Column({ nullable: true })
    planned_end_date!: Date; // ! Expected completion date

    @Column({ nullable: true })
    actual_end_date!: Date; // ! When trip actually finished (set when status changes to completed)

    @Column({
        type: 'enum',
        enum: TripStatus,
        default: TripStatus.PLANNED
    })
    status!: TripStatus; // ! Current state of the trip for filtering and display

    @Column({ default: true })
    is_public!: boolean; // ! Whether other users can see this trip in community features

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    estimated_distance!: number; // ! Planned distance in kilometers (calculated from route)

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    actual_distance!: number; // ! Real distance traveled (tracked via GPS/location updates)

    @Column({ type: 'decimal', precision: 8, scale: 2, default: 0 })
    carbon_saved!: number; // ! CO2 savings vs car/plane travel (kg CO2) for eco-points

    @Column({ type: 'json', nullable: true })
    route_polyline!: object; // ! Encoded route path for map display (Google/MapBox polyline)

    @Column({ type: 'text', array: true, default: [] })
    travel_modes!: string[]; // ! Methods used: ['hitchhiking', 'walking', 'train'] for statistics

    @Column({ type: 'json', nullable: true })
    weather_conditions!: object; // ! Weather data during trip for safety/planning insights

    @Column({ default: 0 })
    total_rides!: number; // ! Number of successful rides received during trip

    @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
    average_wait_time!: number; // ! Average time waiting for rides (hours) for spot effectiveness

    @Column({ type: 'text', array: true, default: [] })
    countries_visited!: string[]; // ! ISO country codes traversed for user statistics

    @Column({ type: 'text', array: true, default: [] })
    cities_visited!: string[]; // ! Major cities passed through for travel log

    @Column({ type: 'json', nullable: true })
    emergency_contacts!: object; // ! Emergency contact info accessible during active trips

    @Column({ type: 'text', nullable: true })
    notes!: string; // ! User's personal notes, memories, or tips from the trip

    @Column({ type: 'text', array: true, default: [] })
    tags!: string[]; // ! User-defined tags like ['solo', 'budget', 'adventure'] for categorization

    @CreateDateColumn()
    created_at!: Date; // ! When trip was first created in the system

    @UpdateDateColumn()
    updated_at!: Date; // ! Last modification time for change tracking

    // Relationships
    @ManyToOne(() => User, user => user.trips)
    user!: User; // ! The trip owner/creator

    @OneToMany(() => TripSpot, tripSpot => tripSpot.trip)
    trip_spots!: TripSpot[]; // ! Ordered list of spots planned or visited during trip
}