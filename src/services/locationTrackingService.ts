// app/services/locationTrackingService.ts
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from './api';

const LOCATION_TASK_NAME = 'background-location-task';
const LOCATION_STORAGE_KEY = 'tracked_locations';

interface LocationPoint {
    latitude: number;
    longitude: number;
    timestamp: number;
    accuracy?: number;
    speed?: number;
    heading?: number;
}

interface ActiveTrip {
    tripId: string;
    userId: string;
    emergencyContacts: string[];
    trackingEnabled: boolean;
}

class LocationTrackingService {
    private static instance: LocationTrackingService;
    private activeTrip: ActiveTrip | null = null;
    private isTracking = false;
    private locationHistory: LocationPoint[] = [];
    private trackingInterval = 30000; // 30 seconds default

    static getInstance(): LocationTrackingService {
        if (!LocationTrackingService.instance) {
            LocationTrackingService.instance = new LocationTrackingService();
        }
        return LocationTrackingService.instance;
    }

    // Request permissions for location tracking
    async requestPermissions(): Promise<boolean> {
        try {
            // Request foreground permissions first
            const foregroundPermission = await Location.requestForegroundPermissionsAsync();

            if (foregroundPermission.status !== 'granted') {
                throw new Error('Foreground location permission not granted');
            }

            // Request background permissions for continuous tracking
            const backgroundPermission = await Location.requestBackgroundPermissionsAsync();

            if (backgroundPermission.status !== 'granted') {
                console.warn('Background location permission not granted - tracking will be limited');
                return false;
            }

            return true;
        } catch (error) {
            console.error('❌ Location permission error:', error);
            return false;
        }
    }

    // Start tracking for a specific trip
    async startTripTracking(tripData: {
        tripId: string;
        userId: string;
        emergencyContacts: string[];
        trackingMode: 'normal' | 'frequent' | 'battery_saver';
    }): Promise<boolean> {
        try {
            console.log('🚀 Starting trip tracking for:', tripData.tripId);

            const hasPermissions = await this.requestPermissions();
            if (!hasPermissions) {
                throw new Error('Location permissions not granted');
            }

            // Set tracking interval based on mode
            switch (tripData.trackingMode) {
                case 'frequent':
                    this.trackingInterval = 15000; // 15 seconds
                    break;
                case 'battery_saver':
                    this.trackingInterval = 120000; // 2 minutes
                    break;
                default:
                    this.trackingInterval = 30000; // 30 seconds
            }

            this.activeTrip = {
                ...tripData,
                trackingEnabled: true
            };

            // Start background location updates
            await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
                accuracy: Location.Accuracy.High,
                timeInterval: this.trackingInterval,
                distanceInterval: 10, // Update every 10 meters
                deferredUpdatesInterval: this.trackingInterval,
                foregroundService: {
                    notificationTitle: 'Vendro Trip Tracking',
                    notificationBody: 'Tracking your journey for safety',
                    notificationColor: '#D4622A',
                },
                pausesUpdatesAutomatically: false,
                activityType: Location.ActivityType.Fitness,
            });

            this.isTracking = true;

            // Store active trip info
            await AsyncStorage.setItem('active_trip', JSON.stringify(this.activeTrip));

            console.log('✅ Location tracking started successfully');
            return true;

        } catch (error) {
            console.error('❌ Failed to start location tracking:', error);
            return false;
        }
    }

    // Stop tracking
    async stopTripTracking(): Promise<void> {
        try {
            console.log('🛑 Stopping trip tracking');

            if (this.isTracking) {
                await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
                this.isTracking = false;
            }

            // Save final location history
            if (this.activeTrip && this.locationHistory.length > 0) {
                await this.uploadLocationHistory();
            }

            // Clear stored data
            this.activeTrip = null;
            this.locationHistory = [];
            await AsyncStorage.removeItem('active_trip');
            await AsyncStorage.removeItem(LOCATION_STORAGE_KEY);

            console.log('✅ Location tracking stopped');

        } catch (error) {
            console.error('❌ Error stopping location tracking:', error);
        }
    }

    // Get current trip status
    async getTripStatus(): Promise<{
        isTracking: boolean;
        activeTrip: ActiveTrip | null;
        locationCount: number;
        lastUpdate?: Date;
    }> {
        // Try to restore active trip from storage
        if (!this.activeTrip) {
            try {
                const storedTrip = await AsyncStorage.getItem('active_trip');
                if (storedTrip) {
                    this.activeTrip = JSON.parse(storedTrip);
                }
            } catch (error) {
                console.error('Error restoring active trip:', error);
            }
        }

        const lastLocation = this.locationHistory[this.locationHistory.length - 1];

        return {
            isTracking: this.isTracking,
            activeTrip: this.activeTrip,
            locationCount: this.locationHistory.length,
            lastUpdate: lastLocation ? new Date(lastLocation.timestamp) : undefined
        };
    }

    // Process new location update
    async processLocationUpdate(location: Location.LocationObject): Promise<void> {
        try {
            if (!this.activeTrip) return;

            const locationPoint: LocationPoint = {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                timestamp: Date.now(),
                accuracy: location.coords.accuracy || undefined,
                speed: location.coords.speed || undefined,
                heading: location.coords.heading || undefined,
            };

            // Add to local history
            this.locationHistory.push(locationPoint);

            // Store locally (keep last 1000 points)
            if (this.locationHistory.length > 1000) {
                this.locationHistory = this.locationHistory.slice(-1000);
            }

            await this.saveLocationHistory();

            // Send to backend every 5 points or every 5 minutes
            if (this.locationHistory.length % 5 === 0 || this.shouldUploadByTime()) {
                await this.uploadLocationHistory();
            }

            // Check for emergency situations
            await this.checkEmergencyConditions(locationPoint);

            console.log('📍 Location updated:', {
                lat: locationPoint.latitude.toFixed(6),
                lng: locationPoint.longitude.toFixed(6),
                accuracy: locationPoint.accuracy
            });

        } catch (error) {
            console.error('❌ Error processing location update:', error);
        }
    }

    // Save location history locally
    private async saveLocationHistory(): Promise<void> {
        try {
            await AsyncStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(this.locationHistory));
        } catch (error) {
            console.error('Error saving location history:', error);
        }
    }

    // Upload location history to backend
    private async uploadLocationHistory(): Promise<void> {
        try {
            if (!this.activeTrip || this.locationHistory.length === 0) return;

            await apiClient.uploadTripLocationHistory(this.activeTrip.tripId, {
                locations: this.locationHistory,
                userId: this.activeTrip.userId
            });

            console.log(`✅ Uploaded ${this.locationHistory.length} location points`);

            // Clear uploaded points (keep last few for emergency checking)
            this.locationHistory = this.locationHistory.slice(-10);

        } catch (error) {
            console.error('❌ Error uploading location history:', error);
            // Don't clear history if upload failed
        }
    }

    // Check if should upload by time (every 5 minutes)
    private shouldUploadByTime(): boolean {
        const lastLocation = this.locationHistory[this.locationHistory.length - 1];
        const firstUnuploaded = this.locationHistory[0];

        if (!lastLocation || !firstUnuploaded) return false;

        return (lastLocation.timestamp - firstUnuploaded.timestamp) > 300000; // 5 minutes
    }

    // Check for emergency situations
    private async checkEmergencyConditions(location: LocationPoint): Promise<void> {
        try {
            if (!this.activeTrip) return;

            const recentLocations = this.locationHistory.slice(-10); // Last 10 points

            // Check if user hasn't moved for extended period (possible emergency)
            if (recentLocations.length >= 5) {
                const isStationary = this.checkIfStationary(recentLocations);
                const timeStationary = this.getStationaryTime(recentLocations);

                // If stationary for over 2 hours, send alert
                if (isStationary && timeStationary > 7200000) { // 2 hours
                    await this.sendEmergencyAlert('stationary', location);
                }
            }

            // Check for unusual speed (possible emergency)
            if (location.speed && location.speed > 50) { // Over 180 km/h
                await this.sendEmergencyAlert('high_speed', location);
            }

        } catch (error) {
            console.error('❌ Error checking emergency conditions:', error);
        }
    }

    // Check if user is stationary
    private checkIfStationary(locations: LocationPoint[]): boolean {
        if (locations.length < 2) return false;

        const threshold = 0.001; // ~100 meters
        const firstLocation = locations[0];

        return locations.every(loc =>
            Math.abs(loc.latitude - firstLocation.latitude) < threshold &&
            Math.abs(loc.longitude - firstLocation.longitude) < threshold
        );
    }

    // Get time user has been stationary
    private getStationaryTime(locations: LocationPoint[]): number {
        if (locations.length < 2) return 0;
        return locations[locations.length - 1].timestamp - locations[0].timestamp;
    }

    // Send emergency alert
    private async sendEmergencyAlert(type: 'stationary' | 'high_speed', location: LocationPoint): Promise<void> {
        try {
            if (!this.activeTrip) return;

            console.log('🚨 Sending emergency alert:', type);

            await apiClient.sendEmergencyAlert({
                tripId: this.activeTrip.tripId,
                userId: this.activeTrip.userId,
                alertType: type,
                location: {
                    latitude: location.latitude,
                    longitude: location.longitude,
                    timestamp: location.timestamp
                },
                emergencyContacts: this.activeTrip.emergencyContacts
            });

        } catch (error) {
            console.error('❌ Error sending emergency alert:', error);
        }
    }

    // Get real-time location (for immediate use)
    async getCurrentLocation(): Promise<LocationPoint | null> {
        try {
            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
                maximumAge: 10000, // Accept 10-second old cached location
            });

            return {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                timestamp: Date.now(),
                accuracy: location.coords.accuracy || undefined,
                speed: location.coords.speed || undefined,
                heading: location.coords.heading || undefined,
            };

        } catch (error) {
            console.error('❌ Error getting current location:', error);
            return null;
        }
    }
}

// Define the background task
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
    if (error) {
        console.error('❌ Background location task error:', error);
        return;
    }

    if (data) {
        const { locations } = data as { locations: Location.LocationObject[] };
        const locationService = LocationTrackingService.getInstance();

        for (const location of locations) {
            await locationService.processLocationUpdate(location);
        }
    }
});

export const locationTrackingService = LocationTrackingService.getInstance();