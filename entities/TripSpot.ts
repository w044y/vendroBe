import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from 'typeorm';
import { Trip } from './Trip';
import { Spot } from './Spot';

export enum TripSpotStatus {
    PLANNED = 'planned',      // ! Spot is planned to visit but not reached yet
    CURRENT = 'current',      // ! Currently at this spot (real-time location)
    VISITED = 'visited',      // ! Successfully used this spot
    SKIPPED = 'skipped',      // ! Planned but decided not to use
    FAILED = 'failed'         // ! Tried to use but couldn't get a ride
}

@Entity('trip_spots')
export class TripSpot {
    @PrimaryGeneratedColumn('uuid')
    id!: string; // ! Unique identifier for this trip-spot relationship

    @Column()
    order_index!: number; // ! Position in the route (0, 1, 2...) for proper ordering

    @Column({
        type: 'enum',
        enum: TripSpotStatus,
        default: TripSpotStatus.PLANNED
    })
    status!: TripSpotStatus; // ! Current state of this spot in the trip

    @Column({ nullable: true })
    arrived_at!: Date; // ! When user reached this spot (GPS tracking or manual check-in)

    @Column({ nullable: true })
    departed_at!: Date; // ! When user left this spot (got a ride or moved on)

    @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
    wait_time_hours!: number; // ! Time spent waiting for a ride at this spot

    @Column({ default: false })
    got_ride!: boolean; // ! Whether user successfully got a ride from this spot

    @Column({ type: 'text', nullable: true })
    ride_details!: string; // ! Notes about the ride (driver, destination, experience)

    @Column({ type: 'text', nullable: true })
    notes!: string; // ! User's notes about this specific spot experience

    @Column({ type: 'json', nullable: true })
    weather_at_visit!: object; // ! Weather conditions when at this spot

    @Column({ type: 'text', array: true, default: [] })
    photos_taken!: string[]; // ! Photos taken at this spot during the trip

    @Column({ type: 'int', nullable: true })
    safety_experience!: number; // ! User's safety rating (1-5) for this specific visit

    @Column({ type: 'int', nullable: true })
    effectiveness_rating!: number; // ! How good this spot was (1-5) for getting rides

    @CreateDateColumn()
    created_at!: Date; // ! When this spot was added to the trip

    // Relationships
    @ManyToOne(() => Trip, trip => trip.trip_spots, { onDelete: 'CASCADE' })
    trip!: Trip; // ! Which trip this belongs to (cascade delete when trip is deleted)

    @ManyToOne(() => Spot, { nullable: false })
    spot!: Spot; // ! The actual hitchhiking spot being visited
}