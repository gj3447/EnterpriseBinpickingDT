import { create } from "zustand";

export interface InferencePose {
  position: [number, number, number];
  quaternion: [number, number, number, number];
}

export interface InferenceResult {
  objectName: string;
  score: number;
  meshPath: string;
  pose: InferencePose;
  timestamp: number;
  rawResponse?: unknown;
  mode?: "full" | "fast";
}

interface InferenceState {
  inferences: Record<string, InferenceResult>;
  upsertInference: (result: InferenceResult) => void;
  clearInference: (objectName: string) => void;
}

export const useInferenceStore = create<InferenceState>((set) => ({
  inferences: {},
  upsertInference: (result) =>
    set((state) => ({
      inferences: {
        ...state.inferences,
        [result.objectName]: result,
      },
    })),
  clearInference: (objectName) =>
    set((state) => {
      if (!(objectName in state.inferences)) {
        return state;
      }

      const { [objectName]: _removed, ...rest } = state.inferences;
      return { inferences: rest };
    }),
}));

