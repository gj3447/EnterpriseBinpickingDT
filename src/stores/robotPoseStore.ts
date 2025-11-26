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
  getPoseByName: (name: string) => RobotPose | undefined;
}

const MAX_POSE_COUNT = 50;
const normalizePoseName = (value?: string) => value?.trim().toLowerCase() ?? '';
const sanitizePoseName = (value?: string) => (value ?? '').trim();
const buildPose = (name: string, jointAnglesDeg: number[]): RobotPose => ({
  id: name,
  name,
  createdAt: Date.now(),
  jointAnglesDeg,
});
const getNextDefaultName = (poses: RobotPose[]) => {
  let index = poses.length + 1;
  let candidate = `자세 ${index}`;
  while (poses.some((pose) => normalizePoseName(pose.name) === normalizePoseName(candidate))) {
    index += 1;
    candidate = `자세 ${index}`;
  }
  return candidate;
};

export const useRobotPoseStore = create<RobotPoseState>()(
  persist(
    (set, get) => ({
      poses: [],
      addPose: ({ name, jointAnglesDeg }) => {
        const safeAngles = Array.isArray(jointAnglesDeg)
          ? jointAnglesDeg.map((value) => (typeof value === 'number' ? value : 0))
          : [];
        const currentPoses = get().poses;
        const rawName = sanitizePoseName(name);
        const nextName = rawName.length > 0 ? rawName : getNextDefaultName(currentPoses);
        const normalized = normalizePoseName(nextName);
        const newPose = buildPose(nextName, safeAngles);
        set((state) => {
          const filtered = state.poses.filter(
            (pose) => normalizePoseName(pose.name) !== normalized
          );
          const nextPoses = [newPose, ...filtered].slice(0, MAX_POSE_COUNT);
          return { poses: nextPoses };
        });
        return newPose;
      },
      updatePoseName: (id, name) =>
        set((state) => {
          const targetName = sanitizePoseName(name);
          if (!targetName) {
            return state;
          }
          const normalized = normalizePoseName(targetName);
          const filtered = state.poses.filter(
            (pose) =>
              pose.id === id ||
              normalizePoseName(pose.name) !== normalized
          );
          return {
            poses: filtered.map((pose) =>
              pose.id === id ? { ...pose, id: targetName, name: targetName } : pose
            ),
          };
        }),
      removePose: (id) =>
        set((state) => ({
          poses: state.poses.filter((pose) => pose.id !== id),
        })),
      clearPoses: () => set({ poses: [] }),
      getPoseByName: (name) =>
        get().poses.find(
          (pose) => normalizePoseName(pose.name) === normalizePoseName(name)
        ),
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


