import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('magic_tokens')
export class MagicToken {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column()
    email!: string;

    @Column({ unique: true })
    token!: string;

    @Column()
    expires_at!: Date;

    @Column({ default: false })
    is_used!: boolean;

    @CreateDateColumn()
    created_at!: Date;
}