'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface RobotPose {
  id: string;
  name: string;
  createdAt: number;
  jointAnglesDeg: number[];
}

interface RobotPoseState {
  poses: RobotPose[];
  addPose: (params: { name?: string; jointAnglesDeg: number[] }) => RobotPose;
  updatePoseName: (id: string, name: string) => void;
  removePose: (id: string) => void;
  clearPoses: () => void;
}

const MAX_POSE_COUNT = 50;

const generateId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `pose-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
};

export const useRobotPoseStore = create<RobotPoseState>()(
  persist(
    (set, get) => ({
      poses: [],
      addPose: ({ name, jointAnglesDeg }) => {
        const safeAngles = Array.isArray(jointAnglesDeg)
          ? jointAnglesDeg.map((value) => (typeof value === 'number' ? value : 0))
          : [];
        const poseCount = get().poses.length;
        const nextName = name?.trim() || `자세 ${poseCount + 1}`;
        const newPose: RobotPose = {
          id: generateId(),
          name: nextName,
          createdAt: Date.now(),
          jointAnglesDeg: safeAngles,
        };
        set((state) => {
          const nextPoses = [newPose, ...state.poses].slice(0, MAX_POSE_COUNT);
          return { poses: nextPoses };
        });
        return newPose;
      },
      updatePoseName: (id, name) =>
        set((state) => ({
          poses: state.poses.map((pose) =>
            pose.id === id ? { ...pose, name: name.trim() || pose.name } : pose
          ),
        })),
      removePose: (id) =>
        set((state) => ({
          poses: state.poses.filter((pose) => pose.id !== id),
        })),
      clearPoses: () => set({ poses: [] }),
    }),
    {
      name: 'robot-pose-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        poses: state.poses,
      }),
      version: 1,
    }
  )
);


