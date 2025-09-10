// services/tripService.ts
import { apiClient } from './api';
import { Trip, TripFormData, TripStatus, TripMemory } from '@/types/trip';

export class TripService {

    async createTrip(tripData: TripFormData): Promise<Trip> {
        try {
            const response = await apiClient.post('/trips', {
                ...tripData,
                status: TripStatus.PLANNED,
                carbon_saved: 0,
                total_rides: 0,
                spots_discovered: 0,
                memories_captured: 0,
            });
            return response.data;
        } catch (error) {
            console.error('Failed to create trip:', error);
            throw new Error('Failed to create trip');
        }
    }

    async getMyTrips(filters?: {
        status?: TripStatus[];
        limit?: number;
        offset?: number;
    }): Promise<Trip[]> {
        try {
            const params = new URLSearchParams();
            if (filters?.status) {
                params.append('status', filters.status.join(','));
            }
            if (filters?.limit) {
                params.append('limit', filters.limit.toString());
            }
            if (filters?.offset) {
                params.append('offset', filters.offset.toString());
            }

            const response = await apiClient.get(`/trips?${params.toString()}`);
            return response.data;
        } catch (error) {
            console.error('Failed to fetch trips:', error);
            throw new Error('Failed to fetch trips');
        }
    }

    async getTripById(id: string): Promise<Trip> {
        try {
            const response = await apiClient.get(`/trips/${id}`);
            return response.data;
        } catch (error) {
            console.error('Failed to fetch trip:', error);
            throw new Error('Trip not found');
        }
    }

    async updateTrip(id: string, updates: Partial<Trip>): Promise<Trip> {
        try {
            const response = await apiClient.patch(`/trips/${id}`, updates);
            return response.data;
        } catch (error) {
            console.error('Failed to update trip:', error);
            throw new Error('Failed to update trip');
        }
    }

    async startTrip(id: string): Promise<Trip> {
        return this.updateTrip(id, {
            status: TripStatus.ACTIVE,
            actual_start_date: new Date(),
        });
    }

    async completeTrip(id: string): Promise<Trip> {
        return this.updateTrip(id, {
            status: TripStatus.COMPLETED,
            actual_end_date: new Date(),
        });
    }

    async deleteTrip(id: string): Promise<void> {
        try {
            await apiClient.delete(`/trips/${id}`);
        } catch (error) {
            console.error('Failed to delete trip:', error);
            throw new Error('Failed to delete trip');
        }
    }

    async addMemoryToTrip(tripId: string, memory: Omit<TripMemory, 'id' | 'trip_id' | 'created_at'>): Promise<TripMemory> {
        try {
            const response = await apiClient.post(`/trips/${tripId}/memories`, memory);
            return response.data;
        } catch (error) {
            console.error('Failed to add memory:', error);
            throw new Error('Failed to add memory');
        }
    }

    async getActiveTrip(): Promise<Trip | null> {
        try {
            const response = await apiClient.get('/trips/active');
            return response.data;
        } catch (error) {
            if (error.response?.status === 404) {
                return null; // No active trip
            }
            console.error('Failed to fetch active trip:', error);
            throw new Error('Failed to fetch active trip');
        }
    }
}

export const tripService = new TripService();