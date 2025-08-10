import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from 'typeorm';
import { User } from './User';
import { Spot } from './Spot';

@Entity('spot_reviews')
export class SpotReview {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'int', width: 1 })
    safety_rating!: number; // 1-5

    @Column({ type: 'int', width: 1 })
    overall_rating!: number; // 1-5

    @Column({ type: 'text', nullable: true })
    comment!: string;

    @Column({ type: 'text', array: true, default: [] })
    photos!: string[];

    @Column({ default: 0 })
    helpful_votes!: number;

    @CreateDateColumn()
    created_at!: Date;

    // Relationships
    @ManyToOne(() => User, user => user.spot_reviews)
    user!: User;

    @ManyToOne(() => Spot, spot => spot.reviews)
    spot!: Spot;
}