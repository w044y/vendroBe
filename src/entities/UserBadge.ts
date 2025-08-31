// src/entities/UserBadge.ts - Complete badge system
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './User';

export enum BadgeCategory {
    TRUST = 'trust',           // Email verified, Phone verified
    REVIEWER = 'reviewer',     // Helpful reviews, Expert reviewer
    CONTRIBUTOR = 'contributor', // Spot creator, Verified spots
    EXPLORER = 'explorer',     // Countries visited, Multi-modal
    COMMUNITY = 'community',   // Community helper, Long-time member
    SPECIAL = 'special'        // Beta tester, Contest winner
}

@Entity('user_badges')
export class UserBadge {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column()
    user_id!: string;

    @Column()
    badge_key!: string; // 'email_verified', 'helpful_reviewer_gold'

    @Column()
    name!: string; // 'Email Verified', 'Expert Reviewer'

    @Column()
    description!: string; // 'Verified email address', 'Left 50+ helpful reviews'

    @Column()
    emoji!: string; // '✅', '⭐', '🏆'

    @Column({
        type: 'enum',
        enum: BadgeCategory
    })
    category!: BadgeCategory;

    @Column({ nullable: true })
    level!: string; // 'bronze', 'silver', 'gold', null for single-level badges

    @Column({ type: 'int', default: 0 })
    sort_order!: number; // For display ordering

    @CreateDateColumn()
    earned_at!: Date;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'user_id' })
    user!: User;
}