// src/components/dt/types.ts
export interface TransformData {
    translation: [number, number, number];
    orientation_quaternion: [number, number, number, number];
}

export interface WebsocketData {
    frame: string;
    board_detected: boolean;
    board: TransformData;
    robot: TransformData;
    camera: TransformData;
    external_markers: { id: number; pose: TransformData }[];
}

