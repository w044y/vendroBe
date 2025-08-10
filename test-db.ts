import 'reflect-metadata';
import { AppDataSource, initializeDatabase } from './config/database';
import { User } from './entities/User';

async function testDatabase() {
    try {
        // Initialize database connection
        await initializeDatabase();

        // Test creating a user
        const userRepository = AppDataSource.getRepository(User);

        const testUser = userRepository.create({
            email: 'test@hitchhub.app',
            display_name: 'Test User',
            username: 'testuser'
        });

        await userRepository.save(testUser);
        console.log('✅ Test user created:', testUser);

        // Test querying
        const users = await userRepository.find();
        console.log('✅ All users:', users);

        process.exit(0);
    } catch (error) {
        console.error('❌ Database test failed:', error);
        process.exit(1);
    }
}

testDatabase();