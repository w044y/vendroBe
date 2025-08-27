// src/enum/enums.ts - Add labels and emojis
export enum SpotType {
    HIGHWAY_ENTRANCE = 'highway_entrance',
    REST_STOP = 'rest_stop',
    GAS_STATION = 'gas_station',
    BRIDGE = 'bridge',
    ROUNDABOUT = 'roundabout',
    PARKING_LOT = 'parking_lot',
    OTHER = 'other'
}

export enum TransportMode {
    HITCHHIKING = 'hitchhiking',
    CYCLING = 'cycling',
    VAN_LIFE = 'van_life',
    WALKING = 'walking'
}

// Add these constants to the backend enums
export const TRANSPORT_MODE_LABELS = {
    [TransportMode.HITCHHIKING]: 'Hitchhiking',
    [TransportMode.CYCLING]: 'Cycling',
    [TransportMode.VAN_LIFE]: 'Van Life',
    [TransportMode.WALKING]: 'Walking'
};

export const TRANSPORT_MODE_EMOJIS = {
    [TransportMode.HITCHHIKING]: '👍',
    [TransportMode.CYCLING]: '🚲',
    [TransportMode.VAN_LIFE]: '🚐',
    [TransportMode.WALKING]: '🚶'
};

export const SPOT_TYPE_LABELS = {
    [SpotType.HIGHWAY_ENTRANCE]: 'Highway Entrance',
    [SpotType.REST_STOP]: 'Rest Stop',
    [SpotType.GAS_STATION]: 'Gas Station',
    [SpotType.BRIDGE]: 'Bridge',
    [SpotType.ROUNDABOUT]: 'Roundabout',
    [SpotType.PARKING_LOT]: 'Parking Lot',
    [SpotType.OTHER]: 'Other'
};