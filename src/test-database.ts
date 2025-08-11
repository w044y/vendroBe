import 'reflect-metadata';
import 'dotenv/config';
import { AppDataSource, initializeDatabase } from './config/database';
import { User } from './entities/User';
import { Spot, SpotType } from './entities/Spot';
import { SpotReview } from './entities/SpotReview';
import { Trip, TripStatus } from './entities/Trip';
import { TripSpot, TripSpotStatus } from './entities/TripSpot';
import { TripCollaborator, CollaboratorRole, InviteStatus } from './entities/TripCollaborator';

async function testDatabase() {
    console.log('🧪 Starting comprehensive database test...\n');

    try {
        // Initialize database connection
        await initializeDatabase();

        // Clear existing test data
        console.log('🧹 Clearing existing test data...');
        await AppDataSource.query('DELETE FROM trip_collaborators');
        await AppDataSource.query('DELETE FROM trip_spots');
        await AppDataSource.query('DELETE FROM spot_reviews');
        await AppDataSource.query('DELETE FROM trip_location_history');
        await AppDataSource.query('DELETE FROM trips');
        await AppDataSource.query('DELETE FROM spots');
        await AppDataSource.query('DELETE FROM users');
        await AppDataSource.query('DELETE FROM magic_tokens');
        console.log('✅ Test data cleared');

        // Test 1: Create Users
        console.log('\n1️⃣ Testing User Creation...');
        const userRepository = AppDataSource.getRepository(User);

        const user1 = userRepository.create({
            email: 'alice@hitchhub.app',
            username: 'alice_traveler',
            display_name: 'Alice Explorer',
            bio: 'Love sustainable travel and meeting new people!'
        });

        const user2 = userRepository.create({
            email: 'bob@hitchhub.app',
            username: 'bob_wanderer',
            display_name: 'Bob Wanderer',
            vendro_points: 150
        });

        await userRepository.save([user1, user2]);
        console.log('✅ Users created:', user1.display_name, user2.display_name);

        // Test 2: Create Spots with PostGIS
        console.log('\n2️⃣ Testing Spot Creation with PostGIS...');
        const spotRepository = AppDataSource.getRepository(Spot);

        const spot1 = spotRepository.create({
            name: 'Berlin Highway A10 Rest Stop',
            description: 'Great visibility, safe parking, friendly drivers',
            latitude: 52.5200,
            longitude: 13.4050,
            location: {
                type: 'Point',
                coordinates: [13.4050, 52.5200]
            } as any,
            spot_type: SpotType.REST_STOP,
            created_by_id: user1.id,  // Fix: Set foreign key ID
            facilities: ['restroom', 'food', 'parking'],
            tips: 'Best time is early morning, drivers are heading to work'
        });

        const spot2 = spotRepository.create({
            name: 'Prague Bridge Exit',
            description: 'Good for rides heading south',
            latitude: 50.0755,
            longitude: 14.4378,
            location: {
                type: 'Point',
                coordinates: [14.4378, 50.0755]
            } as any,
            spot_type: SpotType.BRIDGE,
            created_by_id: user2.id,  // Fix: Set foreign key ID
            is_verified: true
        });

        await spotRepository.save([spot1, spot2]);
        console.log('✅ Spots created with PostGIS locations');

        // Test 3: Create Spot Reviews
        console.log('\n3️⃣ Testing Spot Reviews...');
        const reviewRepository = AppDataSource.getRepository(SpotReview);

        const review1 = reviewRepository.create({
            safety_rating: 5,
            overall_rating: 4,
            comment: 'Excellent spot! Got a ride in 20 minutes.',
            user_id: user2.id,    // Fix: Set foreign key ID
            spot_id: spot1.id,    // Fix: Set foreign key ID
            helpful_votes: 3
        });

        await reviewRepository.save(review1);
        console.log('✅ Review created for spot');

        // Test 4: Create Trip
        console.log('\n4️⃣ Testing Trip Creation...');
        const tripRepository = AppDataSource.getRepository(Trip);

        const trip1 = tripRepository.create({
            title: 'Berlin to Prague Adventure',
            description: 'Sustainable travel across Central Europe',
            start_location: {
                type: 'Point',
                coordinates: [13.4050, 52.5200]
            } as any,
            end_location: {
                type: 'Point',
                coordinates: [14.4378, 50.0755]
            } as any,
            start_address: 'Berlin, Germany',
            end_address: 'Prague, Czech Republic',
            planned_start_date: new Date('2024-07-15'),
            status: TripStatus.PLANNED,
            estimated_distance: 354.5,
            carbon_saved: 45.2,
            travel_modes: ['hitchhiking', 'walking'],
            countries_visited: ['DE', 'CZ'],
            cities_visited: ['Berlin', 'Dresden', 'Prague'],
            tags: ['solo', 'budget', 'adventure'],
            user_id: user1.id  // Fix: Set foreign key ID
        });

        await tripRepository.save(trip1);
        console.log('✅ Trip created:', trip1.title);

        // Test 5: Add Spots to Trip
        console.log('\n5️⃣ Testing Trip-Spot Relationships...');
        const tripSpotRepository = AppDataSource.getRepository(TripSpot);

        const tripSpot1 = tripSpotRepository.create({
            trip_id: trip1.id,    // Fix: Set foreign key ID
            spot_id: spot1.id,    // Fix: Set foreign key ID
            order_index: 0,
            status: TripSpotStatus.PLANNED
        });

        const tripSpot2 = tripSpotRepository.create({
            trip_id: trip1.id,    // Fix: Set foreign key ID
            spot_id: spot2.id,    // Fix: Set foreign key ID
            order_index: 1,
            status: TripSpotStatus.PLANNED
        });

        await tripSpotRepository.save([tripSpot1, tripSpot2]);
        console.log('✅ Trip spots added to route');

        // Test 6: Trip Collaboration (Fix foreign key references)
        console.log('\n6️⃣ Testing Trip Collaboration...');
        const collaboratorRepository = AppDataSource.getRepository(TripCollaborator);

        const collaboration = collaboratorRepository.create({
            trip_id: trip1.id,        // Fix: Set foreign key ID
            user_id: user2.id,        // Fix: Set foreign key ID
            invited_by_id: user1.id,  // Fix: Set foreign key ID
            role: CollaboratorRole.COMPANION,
            status: InviteStatus.ACCEPTED,
            joined_at: new Date(),
            invite_message: 'Want to join my trip to Prague?',
            permissions: {
                can_edit_route: false,
                can_add_spots: true,
                can_update_location: true
            }
        });

        await collaboratorRepository.save(collaboration);
        console.log('✅ Trip collaboration created');

        // Test 7: Spatial Queries (PostGIS)
        console.log('\n7️⃣ Testing PostGIS Spatial Queries...');

        const nearbySpots = await spotRepository
            .createQueryBuilder('spot')
            .where('ST_DWithin(spot.location, ST_MakePoint(:lng, :lat)::geography, :distance)')
            .setParameters({
                lng: 13.4050,
                lat: 52.5200,
                distance: 50000 // 50km in meters
            })
            .getMany();

        console.log(`✅ Found ${nearbySpots.length} spots within 50km of Berlin`);

        // Test 8: Complex Query with Relationships
        console.log('\n8️⃣ Testing Complex Relationship Queries...');

        const fullTrip = await tripRepository
            .createQueryBuilder('trip')
            .leftJoinAndSelect('trip.user', 'user')
            .leftJoinAndSelect('trip.trip_spots', 'tripSpots')
            .leftJoinAndSelect('tripSpots.spot', 'spot')
            .where('trip.id = :tripId', { tripId: trip1.id })
            .getOne();

        console.log('✅ Complex query executed successfully');
        console.log(`   Trip: ${fullTrip?.title}`);
        console.log(`   Owner: ${fullTrip?.user?.display_name}`);
        console.log(`   Spots in route: ${fullTrip?.trip_spots?.length}`);

        // Test 9: Update Operations
        console.log('\n9️⃣ Testing Update Operations...');

        await spotRepository
            .createQueryBuilder()
            .update(Spot)
            .set({
                overall_rating: () => '(SELECT AVG(overall_rating) FROM spot_reviews WHERE spot_id = :spotId)',
                safety_rating: () => '(SELECT AVG(safety_rating) FROM spot_reviews WHERE spot_id = :spotId)'
            })
            .where('id = :spotId', { spotId: spot1.id })
            .execute();

        console.log('✅ Spot ratings updated from reviews');

        // Test 10: Data Validation
        console.log('\n🔟 Testing Data Validation...');

        const spotsCount = await spotRepository.count();
        const usersCount = await userRepository.count();
        const tripsCount = await tripRepository.count();
        const reviewsCount = await reviewRepository.count();

        console.log(`✅ Database contains:`);
        console.log(`   Users: ${usersCount}`);
        console.log(`   Spots: ${spotsCount}`);
        console.log(`   Trips: ${tripsCount}`);
        console.log(`   Reviews: ${reviewsCount}`);

        console.log('\n🎉 All database tests passed successfully!');

    } catch (error) {
        console.error('❌ Database test failed:', error);
        if (error instanceof Error) {
            console.error('Error details:', error.message);
        }
    } finally {
        await AppDataSource.destroy();
        console.log('\n🔌 Database connection closed');
    }
}

testDatabase();