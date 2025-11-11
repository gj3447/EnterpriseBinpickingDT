import { create } from 'zustand';
import type { WebsocketData, TransformData } from '@/components/dt/types';

interface TransformStoreState {
  boardTransform?: TransformData;
  robotTransform?: TransformData;
  cameraTransform?: TransformData;
  externalMarkers: WebsocketData['external_markers'];
  lastUpdated: number | null;
  updateFromWebsocket: (data: WebsocketData) => void;
}

export const useTransformStore = create<TransformStoreState>((set) => ({
  externalMarkers: [],
  lastUpdated: null,
  updateFromWebsocket: (data) =>
    set({
      boardTransform: data.board,
      robotTransform: data.robot,
      cameraTransform: data.camera,
      externalMarkers: data.external_markers ?? [],
      lastUpdated: Date.now(),
    }),
}));
