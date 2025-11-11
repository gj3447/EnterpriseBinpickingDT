import { Euler, MathUtils, Quaternion, Vector3 } from 'three';

import {
  useRobotControlStore,
  radiansToDegrees,
  IK_OFFSET_LIMIT_X,
  IK_OFFSET_LIMIT_Z,
  IK_OFFSET_Y_MIN,
  IK_OFFSET_Y_MAX,
} from '@/stores/robotControlStore';
import { useTransformStore } from '@/stores/transformStore';

export interface IkAutoSolveResult {
  requestLog: string;
  responseJson: unknown;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export async function performIkAutoSolve(): Promise<IkAutoSolveResult> {
  const { boardTransform } = useTransformStore.getState();

  if (!boardTransform) {
    throw new Error('보드 좌표 정보를 아직 수신하지 못했습니다. 잠시 후 다시 시도해 주세요.');
  }

  const robotState = useRobotControlStore.getState();
  const {
    ikOffsetX,
    ikOffsetY,
    ikOffsetZ,
    ikDownwardMode,
    ikEulerRollDeg,
    ikEulerPitchDeg,
    ikEulerYawDeg,
    gripperLengthMm,
    ikWorldPosition,
    setJointAnglesDeg,
    setManualEnabled,
    setGripperEnabled,
    setGripperLengthMm,
  } = robotState;

  const boardTranslationArray = boardTransform.translation ?? [0, 0, 0];
  const boardQuaternionArr = boardTransform.orientation_quaternion ?? [0, 0, 0, 1];
  const boardQuaternion = new Quaternion(
    boardQuaternionArr[0] ?? 0,
    boardQuaternionArr[1] ?? 0,
    boardQuaternionArr[2] ?? 0,
    boardQuaternionArr[3] ?? 1
  ).normalize();

  const boardOrigin = new Vector3(
    boardTranslationArray[1] ?? 0,
    -(boardTranslationArray[0] ?? 0),
    boardTranslationArray[2] ?? 0
  );

  const clampedX = clamp(ikOffsetX, -IK_OFFSET_LIMIT_X, IK_OFFSET_LIMIT_X);
  const clampedY = clamp(ikOffsetZ, -IK_OFFSET_LIMIT_Z, IK_OFFSET_LIMIT_Z);
  const clampedZ = clamp(ikOffsetY, IK_OFFSET_Y_MIN, IK_OFFSET_Y_MAX);

  const fallbackWorld = boardOrigin.clone().add(new Vector3(clampedX, clampedY, clampedZ));

  const translationVector = ikWorldPosition && ikWorldPosition.length === 3
    ? new Vector3(ikWorldPosition[0], ikWorldPosition[1], ikWorldPosition[2])
    : fallbackWorld;

  const translationArrayScene = [
    Number(translationVector.x.toFixed(6)),
    Number(translationVector.y.toFixed(6)),
    Number(translationVector.z.toFixed(6)),
  ] as [number, number, number];

  const boardLocal = translationVector.clone().sub(boardOrigin);

  const rawGripperLengthMm = gripperLengthMm ?? 0;
  const gripperOffsetMeters = Number((Math.max(0, rawGripperLengthMm) / 1000).toFixed(4));
  const gripOffsets: [number] = [gripperOffsetMeters];

  let endpoint = '/api/robot/ik/ikpy';
  let fallbackEndpoint: string | null = null;
  let payload: Record<string, unknown> = {};

  if (ikDownwardMode) {
    payload = {
      target_frame: 'tool',
      translations: [translationArrayScene],
      grip_offsets: gripOffsets,
      hover_height: 0,
      mode: 'auto',
      coordinate_mode: 'base',
    };
    endpoint = '/api/robot/ik/ikpy/downward';
    fallbackEndpoint = '/api/robot/ik/downward';
  } else {
    const euler = new Euler(
      MathUtils.degToRad(ikEulerRollDeg),
      MathUtils.degToRad(ikEulerPitchDeg),
      MathUtils.degToRad(ikEulerYawDeg),
      'XYZ'
    );
    const orientationOffset = new Quaternion().setFromEuler(euler);
    const orientationWorld = boardQuaternion.clone().multiply(orientationOffset);

    payload = {
      target_frame: 'tool',
      pose_targets: [
        {
          translation: translationArrayScene,
          rotation_quaternion: [
            Number(orientationWorld.x.toFixed(6)),
            Number(orientationWorld.y.toFixed(6)),
            Number(orientationWorld.z.toFixed(6)),
            Number(orientationWorld.w.toFixed(6)),
          ],
        },
      ],
      grip_offsets: gripOffsets,
      mode: 'auto',
    };
    fallbackEndpoint = '/api/robot/ik';
  }

  const requestLogObject = {
    endpoint,
    fallbackEndpoint,
    payload,
    world_position_scene: {
      x: translationArrayScene[0],
      y: translationArrayScene[1],
      z: translationArrayScene[2],
    },
    board_display: {
      x: Number(boardLocal.x.toFixed(6)),
      y: Number(boardLocal.y.toFixed(6)),
      z: Number(boardLocal.z.toFixed(6)),
    },
    slider_offsets_ros: {
      x: clampedX,
      y: clampedY,
      z: clampedZ,
    },
  };

  let response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (response.status === 404 && fallbackEndpoint) {
    const text = await response.text();
    requestLogObject.endpointFallbackTriggered = {
      originalStatus: 404,
      originalBody: text,
      retriedWith: fallbackEndpoint,
    };

    response = await fetch(fallbackEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `서버 오류 (${response.status})`);
  }

  const data = await response.json();
  const requestLog = JSON.stringify(requestLogObject, null, 2);

  const jointPositions: number[] | undefined = data?.best?.joint_positions ?? data?.candidates?.[0]?.joint_positions;

  if (!Array.isArray(jointPositions) || jointPositions.length === 0) {
    throw new Error('IK 결과에 관절 값이 포함되어 있지 않습니다.');
  }

  const jointAnglesDeg = jointPositions.slice(0, 6).map((value) => radiansToDegrees(value));
  setJointAnglesDeg(jointAnglesDeg);
  setManualEnabled(true);

  if (jointPositions.length > 6) {
    const gripperLengthMeters = jointPositions[6];
    if (Number.isFinite(gripperLengthMeters)) {
      setGripperEnabled(true);
      setGripperLengthMm(gripperLengthMeters * 1000);
    }
  }

  return {
    requestLog,
    responseJson: data,
  };
}


