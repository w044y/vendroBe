import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Trip } from './Trip';
import { User } from './User';

export enum CollaboratorRole {
    OWNER = 'owner',
    EDITOR = 'editor',
    VIEWER = 'viewer',
    COMPANION = 'companion'
}

export enum InviteStatus {
    PENDING = 'pending',
    ACCEPTED = 'accepted',
    DECLINED = 'declined',
    REMOVED = 'removed'
}

@Entity('trip_collaborators')
export class TripCollaborator {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({
        type: 'enum',
        enum: CollaboratorRole,
        default: CollaboratorRole.VIEWER
    })
    role!: CollaboratorRole;

    @Column({
        type: 'enum',
        enum: InviteStatus,
        default: InviteStatus.PENDING
    })
    status!: InviteStatus;

    @Column({ nullable: true })
    joined_at!: Date;

    @Column({ type: 'json', nullable: true })
    permissions!: object;

    @Column({ type: 'text', nullable: true })
    invite_message!: string;

    @Column({ nullable: true })
    invited_at!: Date;

    // ADD THESE FOREIGN KEY COLUMNS
    @Column()
    trip_id!: string;

    @Column()
    user_id!: string;

    @Column()
    invited_by_id!: string;

    @CreateDateColumn()
    created_at!: Date;

    // Relationships
    @ManyToOne(() => Trip, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'trip_id' })
    trip!: Trip;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'user_id' })
    user!: User;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'invited_by_id' })
    invited_by!: User;
}