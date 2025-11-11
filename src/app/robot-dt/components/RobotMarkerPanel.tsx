'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Vector3 } from 'three';
import { useTransformStore } from '@/stores/transformStore';
import { useRobotControlStore } from '@/stores/robotControlStore';
import { performIkAutoSolve } from '../lib/ikAutoSolve';

const formatMeters = (value: number) => `${value.toFixed(4)} m`;

export function RobotMarkerPanel() {
  const markers = useTransformStore((state) => state.externalMarkers);
  const lastUpdated = useTransformStore((state) => state.lastUpdated);
  const boardTransform = useTransformStore((state) => state.boardTransform);

  const setIkOffsetX = useRobotControlStore((state) => state.setIkOffsetX);
  const setIkOffsetY = useRobotControlStore((state) => state.setIkOffsetY);
  const setIkOffsetZ = useRobotControlStore((state) => state.setIkOffsetZ);
  const setIkWorldPosition = useRobotControlStore((state) => state.setIkWorldPosition);
  const ikOffsetX = useRobotControlStore((state) => state.ikOffsetX);
  const ikOffsetY = useRobotControlStore((state) => state.ikOffsetY);
  const ikOffsetZ = useRobotControlStore((state) => state.ikOffsetZ);
  const ikWorldPosition = useRobotControlStore((state) => state.ikWorldPosition);

  const markerOptions = useMemo(
    () =>
      markers.map((marker) => {
        const [rosX = 0, rosY = 0, rosZ = 0] = marker.pose.translation ?? [0, 0, 0];

        // ROS 측에서 X/Y 축이 뒤집혀 전달되는 문제를 보정한다.
        // 실제 물리 좌표계(보드 기준)와 일치하도록 X<->Y를 교환한 값을 사용한다.
        const correctedTranslation: [number, number, number] = [rosY, -rosX, rosZ];

        return {
          id: marker.id,
          translation: correctedTranslation,
          quaternion: marker.pose.orientation_quaternion,
        };
      }),
    [markers]
  );

  const [selectedId, setSelectedId] = useState<number | null>(markerOptions[0]?.id ?? null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (markerOptions.length === 0) {
      setSelectedId(null);
      return;
    }
    if (selectedId == null || !markerOptions.some((option) => option.id === selectedId)) {
      setSelectedId(markerOptions[0]?.id ?? null);
    }
  }, [markerOptions, selectedId]);

  const selectedMarker = useMemo(
    () => markerOptions.find((marker) => marker.id === selectedId) ?? null,
    [markerOptions, selectedId]
  );

  const applyMarkerToIkTarget = useCallback(async () => {
    if (!selectedMarker) {
      setFeedback('선택된 마커가 없습니다.');
      return;
    }

    if (!boardTransform) {
      setFeedback('보드 변환 정보를 아직 수신하지 못했습니다.');
      return;
    }

    const markerWorld = new Vector3(
      selectedMarker.translation[0] ?? 0,
      selectedMarker.translation[1] ?? 0,
      selectedMarker.translation[2] ?? 0
    );

    const boardTranslationArr = boardTransform.translation ?? [0, 0, 0];
    const boardOriginWorld = new Vector3(
      boardTranslationArr[1] ?? 0,
      -(boardTranslationArr[0] ?? 0),
      boardTranslationArr[2] ?? 0
    );

    const rosDelta = markerWorld.clone().sub(boardOriginWorld);

    setIkOffsetX(rosDelta.x);
    setIkOffsetY(rosDelta.z);
    setIkOffsetZ(rosDelta.y);
    setIkWorldPosition([markerWorld.x, markerWorld.y, markerWorld.z]);

    try {
      await performIkAutoSolve();
      setFeedback(`Marker #${selectedMarker.id} 좌표를 IK 타깃으로 적용했습니다.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'IK 자동 계산 중 오류가 발생했습니다.');
    }
  }, [boardTransform, selectedMarker, setIkOffsetX, setIkOffsetY, setIkOffsetZ, setIkWorldPosition]);

  useEffect(() => {
    if (selectedMarker) {
      void applyMarkerToIkTarget();
    } else if (markerOptions.length === 0) {
      setFeedback('마커 탐지를 기다리는 중입니다.');
    }
  }, [applyMarkerToIkTarget, markerOptions.length, selectedMarker]);

  return (
    <div className="h-full bg-neutral-900 text-neutral-100 flex flex-col">
      <header className="px-6 pt-6 pb-4 border-b border-neutral-800">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">ArUco 마커 선택</h2>
            <p className="text-sm text-neutral-400 mt-1">마커를 선택하면 IK 타깃이 동일 위치로 이동합니다.</p>
          </div>
        </div>
        <div className="mt-4 text-xs text-neutral-500 space-y-1">
          <p>탐지된 마커 수: {markerOptions.length}</p>
          <p>업데이트 시간: {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : '—'}</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        <section className="bg-neutral-900/70 border border-neutral-800 rounded-2xl px-4 py-5 shadow-lg shadow-black/10">
          <header className="flex items-center justify-between">
            <span className="text-sm font-semibold text-neutral-200">감지된 마커</span>
            <span className="text-xs text-neutral-500">실시간 갱신</span>
          </header>

          {markerOptions.length === 0 ? (
            <p className="mt-4 text-sm text-neutral-500">현재 감지된 마커가 없습니다.</p>
          ) : (
            <div className="mt-4 space-y-4">
              <label className="text-xs text-neutral-500 uppercase tracking-wide" htmlFor="aruco-marker-select">
                마커 선택
              </label>
              <select
                id="aruco-marker-select"
                value={selectedId ?? ''}
                onChange={(event) => setSelectedId(Number(event.target.value))}
                className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
              >
                {markerOptions.map((marker) => (
                  <option key={marker.id} value={marker.id}>
                    Marker #{marker.id}
                  </option>
                ))}
              </select>

              {selectedMarker && (
                <div className="grid grid-cols-3 gap-4 text-xs text-neutral-400">
                  <div>
                    <p className="font-semibold text-neutral-200 uppercase text-[11px]">Marker Position (ROS)</p>
                    <p>X: {formatMeters(selectedMarker.translation[0])}</p>
                    <p>Y: {formatMeters(selectedMarker.translation[1])}</p>
                    <p>Z: {formatMeters(selectedMarker.translation[2])}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-neutral-200 uppercase text-[11px]">보드 로컬 (슬라이더)</p>
                    <p>X(width): {formatMeters(ikOffsetX)}</p>
                    <p>Z(depth): {formatMeters(ikOffsetZ)}</p>
                    <p>Y(height): {formatMeters(ikOffsetY)}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-neutral-200 uppercase text-[11px]">IK Target (ROS)</p>
                    <p>X: {formatMeters(ikWorldPosition?.[0] ?? 0)}</p>
                    <p>Y: {formatMeters(ikWorldPosition?.[1] ?? 0)}</p>
                    <p>Z: {formatMeters(ikWorldPosition?.[2] ?? 0)}</p>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  void applyMarkerToIkTarget();
                }}
                className="px-3 py-2 text-xs font-semibold uppercase tracking-widest rounded-full border border-neutral-700 text-neutral-200 hover:border-neutral-500 transition-colors"
              >
                선택 마커로 타깃 맞추기
              </button>

              {feedback && <p className="text-xs text-neutral-400">{feedback}</p>}
            </div>
          )}
        </section>
      </div>

      <footer className="px-6 py-4 border-t border-neutral-800 text-xs text-neutral-500">
        마커 좌표는 ROS 월드(Z-up) 기준이며, IK 타깃은 동일 좌표로 즉시 이동합니다.
      </footer>
    </div>
  );
}


