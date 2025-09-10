// src/types/tripTypes.ts - Create this file in the backend
export interface RealityEntry {
    id: string;
    planned_spot_id?: string;
    actual_location: {
        latitude: number;
        longitude: number;
        name: string;
        address?: string;
    };
    planned_vs_reality: 'matched' | 'different' | 'spontaneous';
    experience_rating: number;
    worth_it_rating: 'skip' | 'ok' | 'worth_it' | 'must_see';
    photos: TripPhoto[];
    notes: string;
    wish_i_knew: string;
    timestamp: string;
    added_by: string;
    weather_conditions?: string;
    time_spent_minutes?: number;
    cost_notes?: string;
}

export interface TripPhoto {
    id: string;
    url: string;
    thumbnail_url?: string;
    caption?: string;
    gps_location: {
        latitude: number;
        longitude: number;
    };
    timestamp: string;
    is_cover_photo: boolean;
    added_by: string;
}

export interface DailyUpdate {
    id: string;
    date: string;
    day_number: number;
    mood_rating: 1 | 2 | 3 | 4 | 5;
    energy_level: 1 | 2 | 3 | 4 | 5;
    weather: 'sunny' | 'cloudy' | 'rainy' | 'snowy' | 'mixed';
    highlight: string;
    challenge: string;
    discovery: string;
    gratitude: string;
    photos: string[];
    voice_notes: string[];
    videos?: string[];
    starting_location?: {
        name: string;
        latitude: number;
        longitude: number;
    };
    ending_location?: {
        name: string;
        latitude: number;
        longitude: number;
    };
    distance_traveled_km?: number;
    accommodation: {
        type: 'hotel' | 'hostel' | 'camping' | 'friend' | 'other';
        name?: string;
        cost?: number;
        rating?: 1 | 2 | 3 | 4 | 5;
        notes?: string;
    };
    meals: {
        breakfast?: string;
        lunch?: string;
        dinner?: string;
        local_specialties?: string[];
        food_cost?: number;
    };
    transport: {
        methods: string[];
        cost?: number;
        notes?: string;
    };
    lessons_learned?: string;
    tomorrow_plan?: string;
    created_at: string;
    updated_at: string;
    is_public: boolean;
}

export interface ExperienceSummary {
    total_days: number;
    total_distance_km?: number;
    spots_visited: number;
    photos_taken: number;
    must_see_spots: {
        spot_name: string;
        location: { latitude: number; longitude: number };
        why_must_see: string;
    }[];
    hidden_gems: {
        spot_name: string;
        location: { latitude: number; longitude: number };
        discovery_story: string;
    }[];
    skip_these: {
        spot_name: string;
        location: { latitude: number; longitude: number };
        why_skip: string;
    }[];
    lessons_learned: string[];
    would_do_differently: string[];
    best_time_to_visit?: string;
    budget_breakdown?: {
        accommodation: number;
        food: number;
        transport: number;
        activities: number;
        total: number;
        currency: string;
    };
    difficulty_rating: 1 | 2 | 3 | 4 | 5;
    solo_friendly: boolean;
    group_friendly: boolean;
    best_for: string[];
    one_line_summary: string;
    highlight_story: string;
    created_at: string;
}