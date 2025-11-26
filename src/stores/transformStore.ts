import { create } from 'zustand';
import type { WebsocketData, TransformData } from '@/components/dt/types';

export type TransformConnectionState = 'connecting' | 'open' | 'closed';

interface TransformStoreState {
  boardTransform?: TransformData;
  robotTransform?: TransformData;
  cameraTransform?: TransformData;
  externalMarkers: WebsocketData['external_markers'];
  lastUpdated: number | null;
  connectionState: TransformConnectionState;
  updateFromWebsocket: (data: WebsocketData) => void;
  setConnectionState: (state: TransformConnectionState) => void;
}

export const useTransformStore = create<TransformStoreState>((set) => ({
  externalMarkers: [],
  lastUpdated: null,
  connectionState: 'connecting',
  updateFromWebsocket: (data) =>
    set({
      boardTransform: data.board,
      robotTransform: data.robot,
      cameraTransform: data.camera,
      externalMarkers: data.external_markers ?? [],
      lastUpdated: Date.now(),
      connectionState: 'open',
    }),
  setConnectionState: (state) => set({ connectionState: state }),
}));
