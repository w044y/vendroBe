import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from 'typeorm';
import { Trip } from './Trip';
import { User } from './User';

export enum CollaboratorRole {
    OWNER = 'owner',        // ! Original trip creator (full control)
    EDITOR = 'editor',      // ! Can modify trip details and route
    VIEWER = 'viewer',      // ! Can only view trip details
    COMPANION = 'companion' // ! Traveling together (can update location)
}

export enum InviteStatus {
    PENDING = 'pending',    // ! Invitation sent but not responded to
    ACCEPTED = 'accepted',  // ! User accepted and joined the trip
    DECLINED = 'declined',  // ! User declined the invitation
    REMOVED = 'removed'     // ! User was removed from the trip
}

@Entity('trip_collaborators')
export class TripCollaborator {
    @PrimaryGeneratedColumn('uuid')
    id!: string; // ! Unique identifier for this collaboration

    @Column({
        type: 'enum',
        enum: CollaboratorRole,
        default: CollaboratorRole.VIEWER
    })
    role!: CollaboratorRole; // ! Permission level for this user on this trip

    @Column({
        type: 'enum',
        enum: InviteStatus,
        default: InviteStatus.PENDING
    })
    status!: InviteStatus; // ! Current state of the collaboration invitation

    @Column({ nullable: true })
    joined_at!: Date; // ! When user accepted and joined the trip

    @Column({ type: 'json', nullable: true })
    permissions!: object; // ! Granular permissions: {can_edit_route: true, can_add_spots: false}

    @Column({ type: 'text', nullable: true })
    invite_message!: string; // ! Personal message sent with the invitation

    @Column({ nullable: true })
    invited_at!: Date; // ! When the invitation was sent

    @CreateDateColumn()
    created_at!: Date; // ! When this collaboration record was created

    // Relationships
    @ManyToOne(() => Trip, { onDelete: 'CASCADE' })
    trip!: Trip; // ! Which trip this collaboration is for

    @ManyToOne(() => User)
    user!: User; // ! The collaborating user

    @ManyToOne(() => User)
    invited_by!: User; // ! Who sent the invitation
}