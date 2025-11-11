'use client';

import { useCallback, ChangeEvent, useMemo } from 'react';

import {
  GRIPPER_LENGTH_LIMITS_MM,
  JOINT_ACCELERATION_RANGE,
  JOINT_VELOCITY_RANGE,
  useRobotControlStore,
} from '@/stores/robotControlStore';
import { useOpcUaStore } from '@/stores/opcUaStore';
const JOINT_LABELS = ['J1', 'J2', 'J3', 'J4', 'J5', 'J6'];
const TCP_LABELS = ['X', 'Y', 'Z', 'Rx', 'Ry', 'Rz'];
const TORQUE_LABELS = JOINT_LABELS;
const TOOL_FORCE_LABELS = ['Fx', 'Fy', 'Fz', 'Mx', 'My', 'Mz'];

const formatMillimeters = (value: number) => `${value.toFixed(0)} mm`;
const formatAngle = (value: number | null | undefined) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '—';
  }
  return `${value.toFixed(2)}°`;
};
const formatLinear = (value: number | null | undefined, unit: 'm' | 'deg' = 'm') => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '—';
  }
  return unit === 'm' ? `${value.toFixed(3)} m` : `${value.toFixed(2)}°`;
};
const formatTorque = (value: number | null | undefined) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '—';
  }
  return `${value.toFixed(2)} Nm`;
};
const formatForce = (value: number | null | undefined) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '—';
  }
  return `${value.toFixed(2)} N`;
};
const formatMoment = (value: number | null | undefined) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '—';
  }
  return `${value.toFixed(2)} N·m`;
};
const formatPlainNumber = (value: number | null, fractionDigits = 3) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '—';
  }
  return value.toFixed(fractionDigits);
};
const describeMotionState = (value: number | null) => {
  switch (value) {
    case 0:
      return '정지';
    case 1:
      return '동작 중';
    case 2:
      return '알람';
    default:
      return '알 수 없음';
  }
};
const describeCommandStatus = (value: number | null) => {
  switch (value) {
    case 0:
      return '완료';
    case 1:
      return '실행 중';
    case 2:
      return '오류';
    default:
      return '알 수 없음';
  }
};
const describeMode = (value: number | null) => {
  switch (value) {
    case 1:
      return 'moveJ (1)';
    case 2:
      return 'moveL (2)';
    case 0:
      return '대기 (0)';
    default:
      return value === null ? '—' : `알 수 없음 (${value})`;
  }
};

export function RobotSettingsPanel() {
  const gripperEnabled = useRobotControlStore((state) => state.gripperEnabled);
  const gripperLengthMm = useRobotControlStore((state) => state.gripperLengthMm);
  const setGripperEnabled = useRobotControlStore((state) => state.setGripperEnabled);
  const setGripperLengthMm = useRobotControlStore((state) => state.setGripperLengthMm);
  const setJointAnglesDeg = useRobotControlStore((state) => state.setJointAnglesDeg);
  const jointVelocity = useRobotControlStore((state) => state.jointVelocity);
  const jointAcceleration = useRobotControlStore((state) => state.jointAcceleration);
  const setJointVelocity = useRobotControlStore((state) => state.setJointVelocity);
  const setJointAcceleration = useRobotControlStore((state) => state.setJointAcceleration);

  const handleToggle = useCallback(() => {
    setGripperEnabled(!gripperEnabled);
  }, [gripperEnabled, setGripperEnabled]);

  const handleSliderChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setGripperLengthMm(Number(event.target.value));
    },
    [setGripperLengthMm]
  );

  const handleNumberChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextValue = Number(event.target.value);
      if (!Number.isNaN(nextValue)) {
        setGripperLengthMm(nextValue);
      }
    },
    [setGripperLengthMm]
  );

  const jointAngles = useOpcUaStore((state) => state.status.currentJoints);
  const tcpPose = useOpcUaStore((state) => state.status.currentTcp);
  const jointTorques = useOpcUaStore((state) => state.status.jointTorques);
  const toolForces = useOpcUaStore((state) => state.status.toolForces);
  const motionState = useOpcUaStore((state) => state.status.motionState);
  const commandStatus = useOpcUaStore((state) => state.status.commandStatus);
  const errorCode = useOpcUaStore((state) => state.status.errorCode);
  const commands = useOpcUaStore((state) => state.commands);
  const opcLoading = useOpcUaStore((state) => state.loading);
  const opcError = useOpcUaStore((state) => state.error);
  const lastUpdated = useOpcUaStore((state) => state.lastUpdated);

  const applyCurrentPoseToDt = useCallback(() => {
    if (!jointAngles || jointAngles.length === 0) {
      return;
    }
    setJointAnglesDeg(jointAngles);
  }, [jointAngles, setJointAnglesDeg]);

  const lastUpdatedLabel = useMemo(() => {
    if (!lastUpdated) {
      return '—';
    }
    return new Date(lastUpdated).toLocaleTimeString();
  }, [lastUpdated]);
  return (
    <div className="h-full bg-neutral-900 text-neutral-100 flex flex-col">
      <header className="px-6 pt-6 pb-4 border-b border-neutral-800">
        <h2 className="text-xl font-semibold tracking-tight">로봇 설정</h2>
        <p className="text-sm text-neutral-400 mt-2">
          엔드 이펙터에 가상의 직사각형 그리퍼를 부착해 작업 공간을 시각화합니다.
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        <section className="bg-neutral-900/70 border border-neutral-800 rounded-2xl px-4 py-5 shadow-lg shadow-black/10">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-semibold text-neutral-200">그리퍼 시각화</span>
              <p className="text-xs text-neutral-500 mt-1">
                길이를 지정하면 엔드 이펙터 끝에서 지정한 길이만큼 직사각형 바를 표시합니다.
              </p>
            </div>
            <button
              type="button"
              onClick={handleToggle}
              className={`relative w-14 h-8 rounded-full transition-colors duration-200 ${
                gripperEnabled ? 'bg-emerald-400/80' : 'bg-neutral-700'
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-neutral-900 transition-transform duration-200 ${
                  gripperEnabled ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
              <span className="sr-only">그리퍼 시각화 토글</span>
            </button>
          </div>
        </section>

        <section className="bg-neutral-900/70 border border-neutral-800 rounded-2xl px-4 py-5 shadow-lg shadow-black/10">
          <header className="flex items-center justify-between">
            <span className="text-sm font-semibold text-neutral-200">그리퍼 길이</span>
            <span className="text-sm text-emerald-300 font-medium">
              {formatMillimeters(gripperLengthMm)}
            </span>
          </header>
          <p className="text-xs text-neutral-500 mt-1">
            최소 {formatMillimeters(GRIPPER_LENGTH_LIMITS_MM.min)} ~ 최대{' '}
            {formatMillimeters(GRIPPER_LENGTH_LIMITS_MM.max)} 범위에서 설정할 수 있습니다.
          </p>

          <div className="mt-4 space-y-3">
            <input
              type="range"
              min={GRIPPER_LENGTH_LIMITS_MM.min}
              max={GRIPPER_LENGTH_LIMITS_MM.max}
              step={5}
              value={gripperLengthMm}
              onChange={handleSliderChange}
              disabled={!gripperEnabled}
              className="w-full accent-emerald-500 disabled:opacity-40"
            />

            <div className="flex items-center gap-3">
              <input
                type="number"
                min={GRIPPER_LENGTH_LIMITS_MM.min}
                max={GRIPPER_LENGTH_LIMITS_MM.max}
                step={1}
                value={gripperLengthMm}
                onChange={handleNumberChange}
                disabled={!gripperEnabled}
                className="w-28 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:text-neutral-500"
              />
              <span className="text-xs text-neutral-500">밀리미터 단위</span>
            </div>
          </div>
        </section>

        <section className="bg-neutral-900/70 border border-neutral-800 rounded-2xl px-4 py-5 shadow-lg shadow-black/10 space-y-4">
          <header className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-neutral-200">동작 파라미터</span>
            <p className="text-xs text-neutral-500">
              Push 시 OPC 서버로 전달할 moveJ 속도/가속도를 설정합니다.
            </p>
          </header>

          <div className="space-y-3">
            <label className="flex flex-col gap-2 text-xs text-neutral-400">
              <div className="flex items-center justify-between">
                <span>Joint Velocity</span>
                <span className="text-neutral-300">{jointVelocity.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min={JOINT_VELOCITY_RANGE.min}
                max={JOINT_VELOCITY_RANGE.max}
                step={1}
                value={jointVelocity}
                onChange={(event) => setJointVelocity(Number(event.target.value))}
                className="w-full accent-emerald-500"
              />
            </label>

            <label className="flex flex-col gap-2 text-xs text-neutral-400">
              <div className="flex items-center justify-between">
                <span>Joint Acceleration</span>
                <span className="text-neutral-300">{jointAcceleration.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min={JOINT_ACCELERATION_RANGE.min}
                max={JOINT_ACCELERATION_RANGE.max}
                step={1}
                value={jointAcceleration}
                onChange={(event) => setJointAcceleration(Number(event.target.value))}
                className="w-full accent-emerald-500"
              />
            </label>
          </div>
        </section>

        <section className="bg-neutral-900/70 border border-neutral-800 rounded-2xl px-4 py-5 shadow-lg shadow-black/10 space-y-5">
          <header className="flex items-center justify-between gap-3">
            <div>
              <span className="text-sm font-semibold text-neutral-200">OPC UA 조인트 상태</span>
              <p className="text-xs text-neutral-500 mt-1">
                Gateway OPC UA 서버에서 현재 조인트 각도를 비롯한 상태 정보를 읽어옵니다.
              </p>
            </div>
            <button
              type="button"
              onClick={applyCurrentPoseToDt}
              disabled={!jointAngles || jointAngles.length === 0 || opcLoading}
              className="px-3 py-2 rounded-full border border-emerald-700 text-xs font-semibold uppercase tracking-wider text-emerald-300 hover:border-emerald-500 hover:text-emerald-100 transition-colors disabled:opacity-50"
            >
              DT에 적용
            </button>
          </header>

          <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500">
            <span>최근 갱신: {lastUpdatedLabel}</span>
            {opcLoading && <span className="text-emerald-300">데이터를 불러오는 중…</span>}
          </div>

          {opcError && <p className="text-xs text-rose-400">{opcError}</p>}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-neutral-300">
            <div className="rounded-lg border border-neutral-800 bg-neutral-900/70 px-3 py-2">
              <span className="block text-neutral-500 uppercase tracking-wider text-[10px]">Motion State</span>
              <span className="text-sm font-semibold text-neutral-100">
                {describeMotionState(motionState)}
                {typeof motionState === 'number' ? ` (${motionState})` : ''}
              </span>
            </div>
            <div className="rounded-lg border border-neutral-800 bg-neutral-900/70 px-3 py-2">
              <span className="block text-neutral-500 uppercase tracking-wider text-[10px]">Command Status</span>
              <span className="text-sm font-semibold text-neutral-100">
                {describeCommandStatus(commandStatus)}
                {typeof commandStatus === 'number' ? ` (${commandStatus})` : ''}
              </span>
            </div>
            <div className="rounded-lg border border-neutral-800 bg-neutral-900/70 px-3 py-2">
              <span className="block text-neutral-500 uppercase tracking-wider text-[10px]">Error Code</span>
              <span className="text-sm font-semibold text-neutral-100">
                {typeof errorCode === 'number' ? errorCode : '—'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm text-neutral-100">
            {JOINT_LABELS.map((label, index) => (
              <div
                key={label}
                className="flex items-center justify-between rounded-md bg-neutral-900/70 border border-neutral-800 px-3 py-2"
              >
                <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">{label}</span>
                <span>{formatAngle(jointAngles?.[index])}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <section className="space-y-2 border border-neutral-800 bg-neutral-900/60 rounded-xl p-4">
              <header className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Current TCP</span>
                <span className="text-[10px] text-neutral-500">XYZ(m) / RPY(°)</span>
              </header>
              <div className="grid grid-cols-3 gap-3 text-sm text-neutral-100">
                {TCP_LABELS.map((label, index) => (
                  <div key={label} className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</span>
                    <span>{index < 3 ? formatLinear(tcpPose?.[index], 'm') : formatLinear(tcpPose?.[index], 'deg')}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-2 border border-neutral-800 bg-neutral-900/60 rounded-xl p-4">
              <header className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Joint Torques</span>
                <span className="text-[10px] text-neutral-500">Nm</span>
              </header>
              <div className="grid grid-cols-3 gap-3 text-sm text-neutral-100">
                {TORQUE_LABELS.map((label, index) => (
                  <div key={label} className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</span>
                    <span>{formatTorque(jointTorques?.[index])}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="space-y-2 border border-neutral-800 bg-neutral-900/60 rounded-xl p-4">
            <header className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Tool Forces & Moments</span>
              <span className="text-[10px] text-neutral-500">N / N·m</span>
            </header>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3 text-sm text-neutral-100">
              {TOOL_FORCE_LABELS.map((label, index) => (
                <div key={label} className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</span>
                  <span>{index < 3 ? formatForce(toolForces?.[index]) : formatMoment(toolForces?.[index])}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-2 border border-neutral-800 bg-neutral-900/60 rounded-xl p-4">
            <header className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Command Values</span>
              <span className="text-[10px] text-neutral-500">현재 OPC 명령 입력</span>
            </header>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm text-neutral-100">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wider text-neutral-500">Mode</span>
                <span>{describeMode(commands.mode)}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wider text-neutral-500">JVel</span>
                <span>{formatPlainNumber(commands.jVel ?? jointVelocity, 2)}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wider text-neutral-500">JAcc</span>
                <span>{formatPlainNumber(commands.jAcc ?? jointAcceleration, 2)}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wider text-neutral-500">LVel</span>
                <span>{formatPlainNumber(commands.lVel, 3)}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wider text-neutral-500">LAcc</span>
                <span>{formatPlainNumber(commands.lAcc, 3)}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wider text-neutral-500">Trigger</span>
                <span>{formatPlainNumber(commands.trigger, 0)}</span>
              </div>
            </div>
          </section>
        </section>
      </div>

      <footer className="px-6 py-4 border-t border-neutral-800 text-xs text-neutral-500 space-y-1">
        <p>그리퍼 시각화는 디지털 트윈 환경에서만 표시되며 실제 하드웨어에는 영향을 주지 않습니다.</p>
        <p>길이는 엔드 이펙터 축을 따라 적용됩니다.</p>
      </footer>
    </div>
  );
}