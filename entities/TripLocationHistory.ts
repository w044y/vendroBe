import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, Point } from 'typeorm';
import { Trip } from './Trip';
import { User } from './User';
import { Spot } from './Spot';

export enum ActivityType {
    WALKING = 'walking',        // ! User is walking to next spot
    WAITING = 'waiting',        // ! Waiting for a ride at a spot
    RIDING = 'riding',          // ! Currently in a vehicle
    RESTING = 'resting',        // ! Taking a break (eating, sleeping)
    HITCHHIKING = 'hitchhiking' // ! Actively trying to get a ride
}

@Entity('trip_location_history')
export class TripLocationHistory {
    @PrimaryGeneratedColumn('uuid')
    id!: string; // ! Unique identifier for this location point

    @Column({
        type: 'geography',
        spatialFeatureType: 'Point',
        srid: 4326,
    })
    location!: Point; // ! PostGIS point for efficient geospatial queries

    @Column({ type: 'decimal', precision: 10, scale: 8 })
    latitude!: number; // ! Decimal latitude for easy access

    @Column({ type: 'decimal', precision: 11, scale: 8 })
    longitude!: number; // ! Decimal longitude for easy access

    @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
    speed!: number; // ! Speed in km/h (0 = stationary, for activity detection)

    @Column({ type: 'decimal', precision: 5, scale: 1, nullable: true })
    accuracy!: number; // ! GPS accuracy in meters (for data quality assessment)

    @Column({
        type: 'enum',
        enum: ActivityType,
        nullable: true
    })
    activity_type!: ActivityType; // ! What user was doing at this location

    @Column({ type: 'int', nullable: true })
    battery_level!: number; // ! Device battery % (for emergency safety features)

    @Column({ type: 'decimal', precision: 5, scale: 1, nullable: true })
    heading!: number; // ! Direction of travel in degrees (0-360)

    @Column({ default: true })
    auto_recorded!: boolean; // ! Whether this was automatic GPS tracking vs manual check-in

    @Column({ type: 'text', nullable: true })
    notes!: string; // ! User notes about this location/time

    @CreateDateColumn()
    timestamp!: Date; // ! Exact time this location was recorded

    // Relationships
    @ManyToOne(() => Trip, { onDelete: 'CASCADE' })
    trip!: Trip; // ! Which trip this location belongs to

    @ManyToOne(() => User)
    user!: User; // ! Which user recorded this location (for multi-user trips)

    @ManyToOne(() => Spot, { nullable: true })
    near_spot!: Spot; // ! If location is near a known spot (within 100m)
}