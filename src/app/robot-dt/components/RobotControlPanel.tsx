'use client';

import { useEffect } from 'react';
import { JOINT_LIMITS_DEG, useRobotControlStore } from '@/stores/robotControlStore';

const AXES = [
  { label: 'J1', description: 'Base rotation' },
  { label: 'J2', description: 'Shoulder pitch' },
  { label: 'J3', description: 'Elbow pitch' },
  { label: 'J4', description: 'Wrist yaw' },
  { label: 'J5', description: 'Wrist pitch' },
  { label: 'J6', description: 'Tool roll' },
];

const SLIDER_STEP = 0.1;

const formatDegrees = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(1)}°`;

export function RobotControlPanel() {
  const jointAnglesDeg = useRobotControlStore((state) => state.jointAnglesDeg);
  const setJointAngleDeg = useRobotControlStore((state) => state.setJointAngleDeg);
  const setManualEnabled = useRobotControlStore((state) => state.setManualEnabled);
  const resetJointAngles = useRobotControlStore((state) => state.resetJointAngles);

  useEffect(() => {
    setManualEnabled(true);
    return () => {
      setManualEnabled(false);
    };
  }, [setManualEnabled]);

  return (
    <div className="h-full bg-neutral-900 text-neutral-100 flex flex-col">
      <header className="px-6 pt-6 pb-4 border-b border-neutral-800">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">로봇 수동 조종</h2>
            <p className="text-sm text-neutral-400 mt-1">
              6축 관절 각도를 조정해 디지털 트윈 로봇을 제어합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={resetJointAngles}
            className="px-3 py-1.5 text-xs font-semibold uppercase tracking-widest rounded-full border border-neutral-700 text-neutral-200 hover:border-neutral-500 transition-colors"
          >
            각도 초기화
          </button>
        </div>
        <div className="mt-4 text-xs text-neutral-500 space-y-1">
          <p>슬라이더는 URDF 상의 각 관절 제한을 그대로 따르며, 0.1° 단위로 조정됩니다.</p>
          <p>수동 모드는 활성화된 동안 실시간 WebSocket 데이터를 덮어씁니다.</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
        {AXES.map((axis, index) => {
          const value = jointAnglesDeg[index] ?? 0;
          const limit = JOINT_LIMITS_DEG[index] ?? { min: -180, max: 180 };
          return (
            <section
              key={axis.label}
              className="bg-neutral-900/70 border border-neutral-800 rounded-2xl px-4 py-4 shadow-lg shadow-black/10"
            >
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-neutral-200 tracking-wide">
                    {axis.label}
                  </span>
                  <span className="text-xs text-neutral-500">{axis.description}</span>
                </div>
                <span className="text-sm font-semibold text-emerald-400">{formatDegrees(value)}</span>
              </div>
              <p className="text-xs text-neutral-500 mt-2">
                범위 {formatDegrees(limit.min)} ~ {formatDegrees(limit.max)}
              </p>
              <input
                type="range"
                min={limit.min}
                max={limit.max}
                step={SLIDER_STEP}
                value={value}
                onChange={(event) => setJointAngleDeg(index, Number(event.target.value))}
                className="w-full mt-4 accent-emerald-500"
              />
              <div className="flex justify-between text-xs text-neutral-500 mt-2">
                <span>{formatDegrees(limit.min)}</span>
                <span>0°</span>
                <span>{formatDegrees(limit.max)}</span>
              </div>
            </section>
          );
        })}
      </div>

      <footer className="px-6 py-4 border-t border-neutral-800 text-xs text-neutral-500">
        수동 조종은 디지털 트윈 시뮬레이션에만 적용되며 실제 로봇에는 명령을 보내지 않습니다.
      </footer>
    </div>
  );
}


