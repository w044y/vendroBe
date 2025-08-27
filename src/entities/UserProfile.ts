// src/entities/UserProfile.ts - New entity for travel preferences
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToOne, JoinColumn } from 'typeorm';
import { User } from './User';
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

    // Travel modes user is interested in
    @Column({
        type: 'simple-array',
        transformer: {
            to: (value: TransportMode[]) => value.join(','),
            from: (value: string) => value ? value.split(',') as TransportMode[] : []
        }
    })
    travel_modes!: TransportMode[];

    // User preferences
    @Column({
        type: 'enum',
        enum: TransportMode
    })
    primary_mode!: TransportMode;

    @Column({ default: false })
    show_all_spots!: boolean;

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

    // Onboarding status
    @Column({ default: false })
    onboarding_completed!: boolean;

    @CreateDateColumn()
    created_at!: Date;

    @UpdateDateColumn()
    updated_at!: Date;

    // Relationship
    @OneToOne(() => User, user => user.profile)
    @JoinColumn({ name: 'user_id' })
    user!: User;
}