// src/entities/TrustVerification.ts - Simple verification tracking
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import {UserProfile} from "../entities/UserProfile";
export enum VerificationType {
    EMAIL = 'email',
    PHONE = 'phone',
    SOCIAL_FACEBOOK = 'social_facebook',
    SOCIAL_GOOGLE = 'social_google',
    COMMUNITY_VOUCH = 'community_vouch'
}
@Entity('trust_verifications')
export class TrustVerification {
    @PrimaryGeneratedColumn('uuid')
    id!: string;
    @Column('uuid')
    user_id!: string;
    @Column({
        type: 'enum',
        enum: VerificationType
    })
    type!: VerificationType;
    @Column({ default: true })
    verified!: boolean;
    @Column({ type: 'json', nullable: true })
    metadata!: {
        platform?: string;     // 'facebook', 'google'
        verified_by?: string;  // user_id for community vouches
        verification_date?: string;
    };
    @CreateDateColumn()
    created_at!: Date;
    @ManyToOne('UserProfile', 'verifications')  // Changed to strings
    @JoinColumn({ name: 'user_id', referencedColumnName: 'user_id' })
    user_profile!: UserProfile;
}