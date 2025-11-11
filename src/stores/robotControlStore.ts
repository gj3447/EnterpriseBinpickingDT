'use client';

import { create } from 'zustand';

export const degreesToRadians = (degrees: number) => (degrees * Math.PI) / 180;

export const radiansToDegrees = (radians: number) => (radians * 180) / Math.PI;

const JOINT_COUNT = 6;

const JOINT_LIMITS_RAD: { min: number; max: number }[] = [
  { min: -6.2832, max: 6.2832 },
  { min: -6.2832, max: 6.2832 },
  { min: -2.7925, max: 2.7925 },
  { min: -6.2832, max: 6.2832 },
  { min: -6.2832, max: 6.2832 },
  { min: -6.2832, max: 6.2832 },
];

const JOINT_VELOCITY_LIMITS = { min: 0, max: 100 } as const;
const JOINT_ACCELERATION_LIMITS = { min: 0, max: 100 } as const;

export const JOINT_LIMITS_DEG = JOINT_LIMITS_RAD.map((limit) => ({
  min: Number(radiansToDegrees(limit.min).toFixed(3)),
  max: Number(radiansToDegrees(limit.max).toFixed(3)),
}));

const GRIPPER_LENGTH_MIN_MM = 0;
const GRIPPER_LENGTH_MAX_MM = 300;
const GRIPPER_LENGTH_DEFAULT_MM = 240;

export const GRIPPER_LENGTH_LIMITS_MM = {
  min: GRIPPER_LENGTH_MIN_MM,
  max: GRIPPER_LENGTH_MAX_MM,
};

export const BOARD_EXTENT_X = 0.8;
export const BOARD_EXTENT_Z = 0.7;
export const IK_OFFSET_LIMIT_X = 1;
export const IK_OFFSET_LIMIT_Z = 1;
export const IK_OFFSET_Y_MIN = -1;
export const IK_OFFSET_Y_MAX = 1;
export const IK_OFFSET_Y_DEFAULT = 0;
export const IK_ANGLE_MIN_DEG = -180;
export const IK_ANGLE_MAX_DEG = 180;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const IK_DOWNWARD_DEFAULT_ROLL_DEG = 180;

export interface RobotControlState {
  manualEnabled: boolean;
  jointAnglesDeg: number[];
  gripperEnabled: boolean;
  gripperLengthMm: number;
  ikEnabled: boolean;
  ikDownwardMode: boolean;
  ikOffsetX: number;
  ikOffsetY: number;
  ikOffsetZ: number;
  ikEulerRollDeg: number;
  ikEulerPitchDeg: number;
  ikEulerYawDeg: number;
  ikWorldPosition: [number, number, number] | null;
  ikAutoSolveRequestKey: number;
  jointVelocity: number;
  jointAcceleration: number;
  setManualEnabled: (enabled: boolean) => void;
  setJointAngleDeg: (index: number, value: number) => void;
  setJointAnglesDeg: (values: number[]) => void;
  resetJointAngles: () => void;
  setGripperEnabled: (enabled: boolean) => void;
  setGripperLengthMm: (length: number) => void;
  setIkEnabled: () => void;
  setIkDownwardMode: (enabled: boolean) => void;
  setIkOffsetX: (value: number) => void;
  setIkOffsetY: (value: number) => void;
  setIkOffsetZ: (value: number) => void;
  setIkEulerRollDeg: (value: number) => void;
  setIkEulerPitchDeg: (value: number) => void;
  setIkEulerYawDeg: (value: number) => void;
  setIkWorldPosition: (position: [number, number, number] | null) => void;
  requestIkAutoSolve: () => void;
  resetIkTarget: () => void;
  setJointVelocity: (value: number) => void;
  setJointAcceleration: (value: number) => void;
}

const initialAngles = Array(JOINT_COUNT).fill(0);

export const useRobotControlStore = create<RobotControlState>((set) => ({
  manualEnabled: false,
  jointAnglesDeg: initialAngles,
  gripperEnabled: false,
  gripperLengthMm: GRIPPER_LENGTH_DEFAULT_MM,
  ikEnabled: true,
  ikDownwardMode: true,
  ikOffsetX: 0,
  ikOffsetY: IK_OFFSET_Y_DEFAULT,
  ikOffsetZ: 0,
  ikEulerRollDeg: IK_DOWNWARD_DEFAULT_ROLL_DEG,
  ikEulerPitchDeg: 0,
  ikEulerYawDeg: 0,
  ikWorldPosition: null,
  ikAutoSolveRequestKey: 0,
  jointVelocity: 50,
  jointAcceleration: 50,
  setManualEnabled: (enabled) => set({ manualEnabled: enabled }),
  setJointAngleDeg: (index, value) =>
    set((state) => {
      if (index < 0 || index >= JOINT_COUNT || Number.isNaN(value)) {
        return state;
      }

      const limit = JOINT_LIMITS_DEG[index];
      const nextAngles = [...state.jointAnglesDeg];
      nextAngles[index] = clamp(value, limit.min, limit.max);

      return {
        jointAnglesDeg: nextAngles,
      };
    }),
  setJointAnglesDeg: (values) =>
    set((state) => {
      if (!Array.isArray(values) || values.length === 0) {
        return state;
      }

      const nextAngles = state.jointAnglesDeg.slice();
      for (let i = 0; i < Math.min(values.length, JOINT_COUNT); i += 1) {
        const value = values[i];
        const limit = JOINT_LIMITS_DEG[i];
        nextAngles[i] = clamp(typeof value === 'number' ? value : 0, limit.min, limit.max);
      }

      return {
        jointAnglesDeg: nextAngles,
      };
    }),
  resetJointAngles: () => set({ jointAnglesDeg: initialAngles }),
  setGripperEnabled: (enabled) => set({ gripperEnabled: enabled }),
  setGripperLengthMm: (length) =>
    set((state) => {
      if (Number.isNaN(length)) {
        return state;
      }
      const clamped = clamp(length, GRIPPER_LENGTH_MIN_MM, GRIPPER_LENGTH_MAX_MM);
      return {
        gripperLengthMm: clamped,
      };
    }),
  setIkEnabled: () => undefined,
  setIkDownwardMode: (enabled) =>
    set((state) => ({
      ikDownwardMode: enabled,
      ikEulerRollDeg: enabled ? IK_DOWNWARD_DEFAULT_ROLL_DEG : state.ikEulerRollDeg === IK_DOWNWARD_DEFAULT_ROLL_DEG ? 0 : state.ikEulerRollDeg,
      ikEulerPitchDeg: enabled ? 0 : state.ikEulerPitchDeg,
      ikEulerYawDeg: enabled ? 0 : state.ikEulerYawDeg,
    })),
  setIkOffsetX: (value) =>
    set((state) => {
      if (Number.isNaN(value)) {
        return state;
      }
      return {
        ikOffsetX: clamp(value, -IK_OFFSET_LIMIT_X, IK_OFFSET_LIMIT_X),
        ikWorldPosition: null,
      };
    }),
  setIkOffsetY: (value) =>
    set((state) => {
      if (Number.isNaN(value)) {
        return state;
      }
      return {
        ikOffsetY: clamp(value, IK_OFFSET_Y_MIN, IK_OFFSET_Y_MAX),
        ikWorldPosition: null,
      };
    }),
  setIkOffsetZ: (value) =>
    set((state) => {
      if (Number.isNaN(value)) {
        return state;
      }
      return {
        ikOffsetZ: clamp(value, -IK_OFFSET_LIMIT_Z, IK_OFFSET_LIMIT_Z),
        ikWorldPosition: null,
      };
    }),
  setIkEulerRollDeg: (value) =>
    set((state) => {
      if (Number.isNaN(value)) {
        return state;
      }
      return {
        ikEulerRollDeg: clamp(value, IK_ANGLE_MIN_DEG, IK_ANGLE_MAX_DEG),
      };
    }),
  setIkEulerPitchDeg: (value) =>
    set((state) => {
      if (Number.isNaN(value)) {
        return state;
      }
      return {
        ikEulerPitchDeg: clamp(value, IK_ANGLE_MIN_DEG, IK_ANGLE_MAX_DEG),
      };
    }),
  setIkEulerYawDeg: (value) =>
    set((state) => {
      if (Number.isNaN(value)) {
        return state;
      }
      return {
        ikEulerYawDeg: clamp(value, IK_ANGLE_MIN_DEG, IK_ANGLE_MAX_DEG),
      };
    }),
  setIkWorldPosition: (position) => set({ ikWorldPosition: position }),
  requestIkAutoSolve: () =>
    set((state) => ({
      ikAutoSolveRequestKey: state.ikAutoSolveRequestKey + 1,
    })),
  resetIkTarget: () =>
    set((state) => ({
      ikOffsetX: 0,
      ikOffsetY: IK_OFFSET_Y_DEFAULT,
      ikOffsetZ: 0,
      ikEulerRollDeg: state.ikDownwardMode ? IK_DOWNWARD_DEFAULT_ROLL_DEG : 0,
      ikEulerPitchDeg: 0,
      ikEulerYawDeg: 0,
      ikWorldPosition: null,
      ikAutoSolveRequestKey: state.ikAutoSolveRequestKey + 1,
    })),
  setJointVelocity: (value) =>
    set((state) => {
      if (Number.isNaN(value)) {
        return state;
      }
      return {
        jointVelocity: clamp(value, JOINT_VELOCITY_LIMITS.min, JOINT_VELOCITY_LIMITS.max),
      };
    }),
  setJointAcceleration: (value) =>
    set((state) => {
      if (Number.isNaN(value)) {
        return state;
      }
      return {
        jointAcceleration: clamp(value, JOINT_ACCELERATION_LIMITS.min, JOINT_ACCELERATION_LIMITS.max),
      };
    }),
}));

export const getJointLimitsRad = (index: number) => JOINT_LIMITS_RAD[index] ?? { min: 0, max: 0 };
export const JOINT_VELOCITY_RANGE = JOINT_VELOCITY_LIMITS;
export const JOINT_ACCELERATION_RANGE = JOINT_ACCELERATION_LIMITS;


