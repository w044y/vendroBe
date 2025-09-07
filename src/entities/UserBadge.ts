// src/entities/UserBadge.ts - FIXED VERSION
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { UserProfile } from './UserProfile';

export enum BadgeCategory {
    TRUST = 'trust',
    REVIEWER = 'reviewer',
    CONTRIBUTOR = 'contributor',
    EXPLORER = 'explorer',
    COMMUNITY = 'community',
    SPECIAL = 'special'
}

@Entity('user_badges')
export class UserBadge {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    // FIX: Make sure this is UUID type to match user_profiles.user_id
    @Column('uuid')
    user_id!: string;

    @Column()
    badge_key!: string;

    @Column()
    name!: string;

    @Column()
    description!: string;

    @Column()
    emoji!: string;

    @Column({
        type: 'enum',
        enum: BadgeCategory
    })
    category!: BadgeCategory;

    @Column({ nullable: true })
    level!: string;

    @Column({ type: 'int', default: 0 })
    sort_order!: number;

    @CreateDateColumn()
    earned_at!: Date;

    // FIX: Proper relationship
    @ManyToOne(() => UserProfile, profile => profile.badges, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id', referencedColumnName: 'user_id' })
    user_profile!: UserProfile;
}