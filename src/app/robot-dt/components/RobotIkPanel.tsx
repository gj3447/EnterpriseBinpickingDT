'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Vector3 } from 'three';
import {
  IK_OFFSET_LIMIT_X,
  IK_OFFSET_LIMIT_Z,
  IK_OFFSET_Y_MIN,
  IK_OFFSET_Y_MAX,
  IK_OFFSET_Y_DEFAULT,
  IK_ANGLE_MAX_DEG,
  IK_ANGLE_MIN_DEG,
  useRobotControlStore,
} from '@/stores/robotControlStore';
import { useTransformStore } from '@/stores/transformStore';
import { performIkAutoSolve } from '../lib/ikAutoSolve';

const formatMeters = (value: number) => `${value.toFixed(3)} m`;
const formatDegrees = (value: number) => `${value.toFixed(1)}°`;

export function RobotIkPanel() {
  const ikOffsetX = useRobotControlStore((state) => state.ikOffsetX);
  const ikOffsetY = useRobotControlStore((state) => state.ikOffsetY);
  const ikOffsetZ = useRobotControlStore((state) => state.ikOffsetZ);
  const ikDownwardMode = useRobotControlStore((state) => state.ikDownwardMode);
  const ikEulerRollDeg = useRobotControlStore((state) => state.ikEulerRollDeg);
  const ikEulerPitchDeg = useRobotControlStore((state) => state.ikEulerPitchDeg);
  const ikEulerYawDeg = useRobotControlStore((state) => state.ikEulerYawDeg);
  const ikWorldPosition = useRobotControlStore((state) => state.ikWorldPosition);
  const ikAutoSolveRequestKey = useRobotControlStore((state) => state.ikAutoSolveRequestKey);
  const setIkOffsetX = useRobotControlStore((state) => state.setIkOffsetX);
  const setIkOffsetY = useRobotControlStore((state) => state.setIkOffsetY);
  const setIkOffsetZ = useRobotControlStore((state) => state.setIkOffsetZ);
  const setIkDownwardMode = useRobotControlStore((state) => state.setIkDownwardMode);
  const setIkEulerRollDeg = useRobotControlStore((state) => state.setIkEulerRollDeg);
  const setIkEulerPitchDeg = useRobotControlStore((state) => state.setIkEulerPitchDeg);
  const setIkEulerYawDeg = useRobotControlStore((state) => state.setIkEulerYawDeg);
  const resetIkTarget = useRobotControlStore((state) => state.resetIkTarget);
  const boardTransform = useTransformStore((state) => state.boardTransform);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverResponse, setServerResponse] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [requestLog, setRequestLog] = useState<string | null>(null);

  const worldPositionForDisplay = useMemo(() => {
    if (!ikWorldPosition) {
      return null;
    }
    return {
      x: ikWorldPosition[0],
      y: ikWorldPosition[1],
      z: ikWorldPosition[2],
    };
  }, [ikWorldPosition]);

  const fallbackSceneWorld = useMemo(() => {
    if (!boardTransform) {
      return null;
    }

    const boardOrigin = new Vector3(
      boardTransform.translation[1] ?? 0,
      -(boardTransform.translation[0] ?? 0),
      boardTransform.translation[2] ?? 0
    );

    const fallbackRos = boardOrigin.clone().add(
      new Vector3(ikOffsetX, ikOffsetZ, ikOffsetY)
    );

    return {
      x: fallbackRos.x,
      y: fallbackRos.y,
      z: fallbackRos.z,
    };
  }, [boardTransform, ikOffsetX, ikOffsetY, ikOffsetZ]);

  const sceneWorldDisplay = worldPositionForDisplay ?? fallbackSceneWorld;
  const payloadWorldDisplay = sceneWorldDisplay
    ? {
        x: sceneWorldDisplay.x,
        y: sceneWorldDisplay.y,
        z: sceneWorldDisplay.z,
      }
    : null;

  const boardLocalDisplay = useMemo(() => {
    if (!sceneWorldDisplay || !boardTransform) {
      return null;
    }

    const boardOrigin = new Vector3(
      boardTransform.translation[1] ?? 0,
      -(boardTransform.translation[0] ?? 0),
      boardTransform.translation[2] ?? 0
    );

    const worldVector = new Vector3(sceneWorldDisplay.x, sceneWorldDisplay.y, sceneWorldDisplay.z);
    const delta = worldVector.clone().sub(boardOrigin);

    return {
      x: delta.x,
      y: delta.y,
      z: delta.z,
    };
  }, [sceneWorldDisplay, boardTransform]);

  const handleIkRequest = useCallback(async () => {
    if (!boardTransform) {
      setErrorMessage('보드 좌표 정보를 아직 수신하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setServerResponse(null);

    try {
      const result = await performIkAutoSolve();
      setRequestLog(result.requestLog);
      setServerResponse(JSON.stringify(result.responseJson, null, 2));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  }, [boardTransform]);

  const autoSolveProcessedRef = useRef(0);

  useEffect(() => {
    if (ikAutoSolveRequestKey === 0) {
      return;
    }

    if (ikAutoSolveRequestKey === autoSolveProcessedRef.current) {
      return;
    }

    if (!boardTransform || isSubmitting) {
      return;
    }

    autoSolveProcessedRef.current = ikAutoSolveRequestKey;
    void handleIkRequest();
  }, [ikAutoSolveRequestKey, boardTransform, isSubmitting, handleIkRequest]);

  const autoSolveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipInitialAutoSolveRef = useRef(true);

  useEffect(() => {
    if (!boardTransform) {
      return;
    }

    if (skipInitialAutoSolveRef.current) {
      skipInitialAutoSolveRef.current = false;
      return;
    }

    if (autoSolveDebounceRef.current) {
      clearTimeout(autoSolveDebounceRef.current);
      autoSolveDebounceRef.current = null;
    }

    autoSolveDebounceRef.current = setTimeout(() => {
      if (isSubmitting) {
        return;
      }
      autoSolveProcessedRef.current = ikAutoSolveRequestKey;
      void handleIkRequest();
    }, 350);

    return () => {
      if (autoSolveDebounceRef.current) {
        clearTimeout(autoSolveDebounceRef.current);
        autoSolveDebounceRef.current = null;
      }
    };
  }, [
    boardTransform,
    handleIkRequest,
    ikAutoSolveRequestKey,
    ikDownwardMode,
    ikEulerPitchDeg,
    ikEulerRollDeg,
    ikEulerYawDeg,
    ikOffsetX,
    ikOffsetY,
    ikOffsetZ,
    isSubmitting,
  ]);

  return (
    <div className="h-full bg-neutral-900 text-neutral-100 flex flex-col">
      <header className="px-6 pt-6 pb-4 border-b border-neutral-800">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">IK 타깃 제어</h2>
            <p className="text-sm text-neutral-400 mt-2">
              보드 영역 위의 목표점을 지정해 로봇 IK 계산에 활용할 수 있습니다.
            </p>
          </div>
          <button
            type="button"
            onClick={resetIkTarget}
            className="px-3 py-1.5 text-xs font-semibold uppercase tracking-widest rounded-full border border-neutral-700 text-neutral-200 hover:border-neutral-500 transition-colors"
          >
            위치 초기화
          </button>
        </div>
        <div className="mt-4 text-xs text-neutral-500 space-y-1">
          <p>
            ROS 기준 범위: X ±{formatMeters(IK_OFFSET_LIMIT_X)}, Y ±{formatMeters(IK_OFFSET_LIMIT_Z)}, Z {formatMeters(IK_OFFSET_Y_MIN)}~{formatMeters(IK_OFFSET_Y_MAX)}.
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        <section className="bg-neutral-900/70 border border-neutral-800 rounded-2xl px-4 py-5 shadow-lg shadow-black/10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="text-sm font-semibold text-neutral-200">말단 Z축 아래 고정</span>
              <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                활성화하면 `/api/robot/ik/downward` 프록시를 사용하여 그리퍼 Z축을 자동으로 아래(-Z)로 맞춥니다.
                회전 슬라이더는 비활성화되고 Roll=180°가 기본값으로 유지됩니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIkDownwardMode(!ikDownwardMode)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer items-center rounded-full border border-neutral-700 transition-colors ${ikDownwardMode ? 'bg-emerald-500/80' : 'bg-neutral-800'}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-neutral-100 transition-transform ${ikDownwardMode ? 'translate-x-5' : 'translate-x-1'}`}
              />
            </button>
          </div>
        </section>

        {(sceneWorldDisplay || boardLocalDisplay) && (
          <section className="bg-neutral-900/70 border border-neutral-800 rounded-2xl px-4 py-5 shadow-lg shadow-black/10">
            <header className="flex items-center justify-between">
              <span className="text-sm font-semibold text-neutral-200">현재 좌표</span>
            </header>
            <div className="mt-3 grid grid-cols-3 gap-4 text-xs text-neutral-400">
              <div>
                <p className="font-semibold text-neutral-200">ROS(World) – 페이로드</p>
                <p>X: {formatMeters(payloadWorldDisplay?.x ?? 0)}</p>
                <p>Y: {formatMeters(payloadWorldDisplay?.y ?? 0)}</p>
                <p>Z: {formatMeters(payloadWorldDisplay?.z ?? 0)}</p>
              </div>
              <div>
                <p className="font-semibold text-neutral-200">ROS(World) – 장면</p>
                <p>X: {formatMeters(sceneWorldDisplay?.x ?? 0)}</p>
                <p>Y: {formatMeters(sceneWorldDisplay?.y ?? 0)}</p>
                <p>Z: {formatMeters(sceneWorldDisplay?.z ?? 0)}</p>
              </div>
              <div>
                <p className="font-semibold text-neutral-200">ROS 오프셋 (보드 기준)</p>
                <p>X (앞뒤): {formatMeters(boardLocalDisplay?.x ?? ikOffsetX)}</p>
                <p>Y (좌우): {formatMeters(boardLocalDisplay?.y ?? ikOffsetZ)}</p>
                <p>Z (높이): {formatMeters(boardLocalDisplay?.z ?? ikOffsetY)}</p>
              </div>
            </div>
          </section>
        )}

        <section className="bg-neutral-900/70 border border-neutral-800 rounded-2xl px-4 py-5 shadow-lg shadow-black/10">
          <header className="flex items-center justify-between">
            <span className="text-sm font-semibold text-neutral-200">앞뒤 이동 (ROS X)</span>
            <span className="text-sm text-emerald-300 font-medium">{formatMeters(ikOffsetX)}</span>
          </header>
          <p className="text-xs text-neutral-500 mt-1">
            ROS X축(전·후) 방향으로 이동합니다. 범위 {formatMeters(-IK_OFFSET_LIMIT_X)} ~ {formatMeters(IK_OFFSET_LIMIT_X)}.
          </p>
          <input
            type="range"
            min={-IK_OFFSET_LIMIT_X}
            max={IK_OFFSET_LIMIT_X}
            step={0.005}
            value={ikOffsetX}
            onChange={(event) => setIkOffsetX(Number(event.target.value))}
            className="w-full mt-4 accent-emerald-500"
          />
        </section>

        <section className="bg-neutral-900/70 border border-neutral-800 rounded-2xl px-4 py-5 shadow-lg shadow-black/10">
          <header className="flex items-center justify-between">
            <span className="text-sm font-semibold text-neutral-200">좌우 이동 (ROS Y)</span>
            <span className="text-sm text-emerald-300 font-medium">{formatMeters(ikOffsetZ)}</span>
          </header>
          <p className="text-xs text-neutral-500 mt-1">
            ROS Y축(좌·우) 방향으로 이동합니다. 범위 {formatMeters(-IK_OFFSET_LIMIT_Z)} ~ {formatMeters(IK_OFFSET_LIMIT_Z)}.
          </p>
          <input
            type="range"
            min={-IK_OFFSET_LIMIT_Z}
            max={IK_OFFSET_LIMIT_Z}
            step={0.005}
            value={ikOffsetZ}
            onChange={(event) => setIkOffsetZ(Number(event.target.value))}
            className="w-full mt-4 accent-emerald-500"
          />
        </section>

        <section className="bg-neutral-900/70 border border-neutral-800 rounded-2xl px-4 py-5 shadow-lg shadow-black/10">
          <header className="flex items-center justify-between">
            <span className="text-sm font-semibold text-neutral-200">높이 이동 (ROS Z)</span>
            <span className="text-sm text-emerald-300 font-medium">{formatMeters(ikOffsetY)}</span>
          </header>
          <p className="text-xs text-neutral-500 mt-1">
            ROS Z축(상·하) 방향으로 이동합니다. 범위 {formatMeters(IK_OFFSET_Y_MIN)} ~ {formatMeters(IK_OFFSET_Y_MAX)}.
          </p>
          <input
            type="range"
            min={IK_OFFSET_Y_MIN}
            max={IK_OFFSET_Y_MAX}
            step={0.01}
            value={ikOffsetY}
            onChange={(event) => setIkOffsetY(Number(event.target.value))}
            className="w-full mt-4 accent-emerald-500"
          />
        </section>

        <section className="bg-neutral-900/70 border border-neutral-800 rounded-2xl px-4 py-5 shadow-lg shadow-black/10">
          <header className="flex items-center justify-between">
            <span className="text-sm font-semibold text-neutral-200">Roll (X축 회전)</span>
            <span className="text-sm text-emerald-300 font-medium">{formatDegrees(ikEulerRollDeg)}</span>
          </header>
          {ikDownwardMode && (
            <p className="text-xs text-neutral-500 mt-1">Downward 모드에서는 Roll이 180°로 고정됩니다.</p>
          )}
          <input
            type="range"
            min={IK_ANGLE_MIN_DEG}
            max={IK_ANGLE_MAX_DEG}
            step={0.5}
            value={ikEulerRollDeg}
            onChange={(event) => setIkEulerRollDeg(Number(event.target.value))}
            disabled={ikDownwardMode}
            className={`w-full mt-4 accent-emerald-500 ${ikDownwardMode ? 'opacity-40 cursor-not-allowed' : ''}`}
          />
        </section>

        <section className="bg-neutral-900/70 border border-neutral-800 rounded-2xl px-4 py-5 shadow-lg shadow-black/10">
          <header className="flex items-center justify-between">
            <span className="text-sm font-semibold text-neutral-200">Pitch (Y축 회전)</span>
            <span className="text-sm text-emerald-300 font-medium">{formatDegrees(ikEulerPitchDeg)}</span>
          </header>
          <input
            type="range"
            min={IK_ANGLE_MIN_DEG}
            max={IK_ANGLE_MAX_DEG}
            step={0.5}
            value={ikEulerPitchDeg}
            onChange={(event) => setIkEulerPitchDeg(Number(event.target.value))}
            disabled={ikDownwardMode}
            className={`w-full mt-4 accent-emerald-500 ${ikDownwardMode ? 'opacity-40 cursor-not-allowed' : ''}`}
          />
        </section>

        <section className="bg-neutral-900/70 border border-neutral-800 rounded-2xl px-4 py-5 shadow-lg shadow-black/10">
          <header className="flex items-center justify-between">
            <span className="text-sm font-semibold text-neutral-200">Yaw (Z축 회전)</span>
            <span className="text-sm text-emerald-300 font-medium">{formatDegrees(ikEulerYawDeg)}</span>
          </header>
          <input
            type="range"
            min={IK_ANGLE_MIN_DEG}
            max={IK_ANGLE_MAX_DEG}
            step={0.5}
            value={ikEulerYawDeg}
            onChange={(event) => setIkEulerYawDeg(Number(event.target.value))}
            disabled={ikDownwardMode}
            className={`w-full mt-4 accent-emerald-500 ${ikDownwardMode ? 'opacity-40 cursor-not-allowed' : ''}`}
          />
        </section>

        <section className="bg-neutral-900/70 border border-neutral-800 rounded-2xl px-4 py-5 shadow-lg shadow-black/10">
          <button
            type="button"
            onClick={handleIkRequest}
            className="w-full py-3 rounded-xl bg-emerald-500 text-neutral-900 font-semibold tracking-wide transition-opacity disabled:opacity-50"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'IK 요청 중...' : 'IK 계산 요청'}
          </button>
          {errorMessage && (
            <div className="mt-3 text-sm text-red-400 bg-red-400/10 border border-red-400/40 px-3 py-2 rounded-lg">
              {errorMessage}
            </div>
          )}
          {requestLog && (
            <div className="mt-3 space-y-2">
              <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">요청 페이로드</h4>
              <pre className="text-xs bg-neutral-950/70 border border-neutral-800 rounded-lg px-3 py-2 overflow-x-auto whitespace-pre-wrap">
                {requestLog}
              </pre>
            </div>
          )}
          {serverResponse && (
            <pre className="mt-3 text-xs bg-neutral-950/70 border border-neutral-800 rounded-lg px-3 py-2 overflow-x-auto whitespace-pre-wrap">
              {serverResponse}
            </pre>
          )}
        </section>
      </div>

      <footer className="px-6 py-4 border-t border-neutral-800 text-xs text-neutral-500 space-y-1">
        <p>IK 타깃은 현재 로봇씬에서만 시각화됩니다.</p>
        <p>초기화 시 위치는 (X: 0, Y: {formatMeters(IK_OFFSET_Y_DEFAULT)}, Z: 0)으로 돌아갑니다.</p>
      </footer>
    </div>
  );
}


