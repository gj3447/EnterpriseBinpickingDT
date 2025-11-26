"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Vector3 } from 'three';

import { useSequenceStore } from '@/stores/sequenceStore';
import { useRobotPoseStore } from '@/stores/robotPoseStore';
import { useRobotControlStore } from '@/stores/robotControlStore';
import { useOpcUaStore } from '@/stores/opcUaStore';
import { useTransformStore } from '@/stores/transformStore';
import { performIkAutoSolve } from '../lib/ikAutoSolve';

export function RobotSequencePanel() {
  const sequences = useSequenceStore((state) => state.sequences);
  const activeId = useSequenceStore((state) => state.activeId);
  const createSequence = useSequenceStore((state) => state.createSequence);
  const updateSequence = useSequenceStore((state) => state.updateSequence);
  const deleteSequence = useSequenceStore((state) => state.deleteSequence);
  const setActiveSequence = useSequenceStore((state) => state.setActiveSequence);
  const getPoseByName = useRobotPoseStore((state) => state.getPoseByName);
  const setJointAnglesDeg = useRobotControlStore((state) => state.setJointAnglesDeg);
  const setManualEnabled = useRobotControlStore((state) => state.setManualEnabled);
  const pushTargetJoints = useOpcUaStore((state) => state.pushTargetJoints);
  const fetchOpcStatus = useOpcUaStore((state) => state.fetchStatus);
  const pulseGripper = useOpcUaStore((state) => state.pulseGripper);
  const getGripperSyncState = useCallback(
    () => useOpcUaStore.getState().status.gripperSyncState,
    []
  );
  const setIkOffsetX = useRobotControlStore((state) => state.setIkOffsetX);
  const setIkOffsetY = useRobotControlStore((state) => state.setIkOffsetY);
  const setIkOffsetZ = useRobotControlStore((state) => state.setIkOffsetZ);
  const setIkWorldPosition = useRobotControlStore((state) => state.setIkWorldPosition);
  const ikWorldPosition = useRobotControlStore((state) => state.ikWorldPosition);
  const gripDepthMm = useRobotControlStore((state) => state.gripDepthMm);

  const activeSequence = useMemo(
    () => sequences.find((seq) => seq.id === activeId) ?? sequences[0],
    [sequences, activeId]
  );

  const [newFileName, setNewFileName] = useState('');
  const [renameValue, setRenameValue] = useState(activeSequence?.name ?? '');
  const [lastRunStatus, setLastRunStatus] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [runProgress, setRunProgress] = useState<string | null>(null);

  useEffect(() => {
    if (!activeId && sequences[0]) {
      setActiveSequence(sequences[0].id);
    }
  }, [activeId, sequences, setActiveSequence]);

  useEffect(() => {
    setRenameValue(activeSequence?.name ?? '');
  }, [activeSequence?.name]);

  const handleCreate = () => {
    const sequence = createSequence(newFileName);
    setNewFileName('');
    setRenameValue(sequence.name);
    setLastRunStatus(`'${sequence.name}' 시퀀스를 생성했습니다.`);
  };

  const handleDelete = () => {
    if (!activeSequence) {
      return;
    }
    deleteSequence(activeSequence.id);
    setLastRunStatus(`'${activeSequence.name}' 시퀀스를 삭제했습니다.`);
  };

  const handleRename = (value: string) => {
    if (!activeSequence) {
      return;
    }
    setRenameValue(value);
    updateSequence(activeSequence.id, { name: value });
  };

  const handleContentChange = (value: string) => {
    if (!activeSequence) {
      return;
    }
    updateSequence(activeSequence.id, { content: value });
  };

  const waitForIdle = useCallback(
    async (label?: string, options?: { check?: 'robot' | 'gripper' }) => {
      const timeoutMs = 20000;
      const pollIntervalMs = 300;
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        await fetchOpcStatus({ silent: true });
        if (options?.check === 'gripper') {
          const syncState = getGripperSyncState();
          if (syncState === true || syncState === null) {
            return true;
          }
        } else {
          const status = useOpcUaStore.getState().status.commandStatus;
          if (status !== 4) {
            return true;
          }
        }
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      }
      throw new Error(label ? `${label} 대기 중 타임아웃` : '대기 타임아웃');
    },
    [fetchOpcStatus, getGripperSyncState]
  );

  const waitForMarker = useCallback(async (markerId: number) => {
    const timeoutMs = 20000;
    const pollIntervalMs = 100;
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const { externalMarkers, boardTransform } = useTransformStore.getState();
      if (boardTransform) {
        const markerCandidate = externalMarkers.find((marker) => marker.id === markerId);
        if (markerCandidate) {
          return { marker: markerCandidate, boardTransform };
        }
      }
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
    return null;
  }, []);

  const executePoseCommand = useCallback(
    async (poseName: string) => {
      const pose = getPoseByName(poseName);
      if (!pose) {
        setLastRunStatus((prev) => prev ?? `포즈 '${poseName}' 를 찾지 못했습니다. 건너뜀`);
        return false;
      }
      setManualEnabled(true);
      setJointAnglesDeg(pose.jointAnglesDeg);
      const controls = useRobotControlStore.getState();
      await pushTargetJoints(pose.jointAnglesDeg, {
        velocity: controls.jointVelocity,
        acceleration: controls.jointAcceleration,
        mode: 1,
      });
      return true;
    },
    [getPoseByName, pushTargetJoints, setJointAnglesDeg, setManualEnabled]
  );

  const executeMarkerCommand = useCallback(
    async (markerIdText: string) => {
      const markerId = Number(markerIdText);
      if (!Number.isFinite(markerId)) {
        setLastRunStatus(`MARKER 명령에 숫자 ID가 필요합니다. 건너뜀`);
        return false;
      }
      setLastRunStatus(`Marker #${markerId} 감지를 기다리는 중…`);
      const markerData = await waitForMarker(markerId);
      if (!markerData) {
        setLastRunStatus(`Marker #${markerId} 감지 대기 중 타임아웃. 건너뜀`);
        return false;
      }
      const { marker: markerRaw, boardTransform } = markerData;
      const [rosX = 0, rosY = 0, rosZ = 0] = markerRaw.pose.translation ?? [0, 0, 0];
      const markerWorld = new Vector3(rosY, -(rosX), rosZ);
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
      } catch (error) {
        setLastRunStatus(
          error instanceof Error ? error.message : 'MARKER IK 계산 실패'
        );
        return false;
      }
      const controls = useRobotControlStore.getState();
      await pushTargetJoints(controls.jointAnglesDeg, {
        velocity: controls.jointVelocity,
        acceleration: controls.jointAcceleration,
        mode: 1,
      });
      return true;
    },
    [pushTargetJoints, setIkOffsetX, setIkOffsetY, setIkOffsetZ, setIkWorldPosition, waitForMarker]
  );

  const moveIkTarget = (delta: Vector3) => {
    const boardTransform = useTransformStore.getState().boardTransform;
    const currentWorld = useRobotControlStore.getState().ikWorldPosition;
    if (!boardTransform || !currentWorld) {
      return null;
    }
    const boardTranslationArr = boardTransform.translation ?? [0, 0, 0];
    const boardOriginWorld = new Vector3(
      boardTranslationArr[1] ?? 0,
      -(boardTranslationArr[0] ?? 0),
      boardTranslationArr[2] ?? 0
    );
    const nextWorld = new Vector3(currentWorld[0], currentWorld[1], currentWorld[2]).add(delta);
    const rosDelta = nextWorld.clone().sub(boardOriginWorld);
    return { nextWorld, rosDelta };
  };

  const executeDownCommand = useCallback(async (customDepthMm?: number) => {
    const depthMm =
      typeof customDepthMm === 'number' && Number.isFinite(customDepthMm)
        ? customDepthMm
        : gripDepthMm;
    const result = moveIkTarget(new Vector3(0, 0, -depthMm / 1000));
    if (!result) {
      setLastRunStatus('DOWN 명령을 위해 IK 타깃이 필요합니다. 건너뜀');
      return false;
    }
    const { nextWorld, rosDelta } = result;
    setIkWorldPosition([nextWorld.x, nextWorld.y, nextWorld.z]);
    setIkOffsetX(rosDelta.x);
    setIkOffsetY(rosDelta.z);
    setIkOffsetZ(rosDelta.y);
    try {
      await performIkAutoSolve();
    } catch (error) {
      setLastRunStatus(error instanceof Error ? error.message : 'DOWN IK 실패');
      return false;
    }
    const controls = useRobotControlStore.getState();
    await pushTargetJoints(controls.jointAnglesDeg, {
      velocity: controls.jointVelocity,
      acceleration: controls.jointAcceleration,
      mode: 1,
    });
    return true;
  }, [gripDepthMm, moveIkTarget, pushTargetJoints, setIkOffsetX, setIkOffsetY, setIkOffsetZ, setIkWorldPosition]);

  const handleRun = useCallback(async () => {
    if (!activeSequence) {
      setLastRunStatus('실행할 시퀀스를 선택해 주세요.');
      return;
    }
    const commands = activeSequence.content
      .split(';')
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0);

    if (commands.length === 0) {
      setLastRunStatus('실행할 명령이 없습니다.');
      return;
    }

    setIsRunning(true);
    setRunProgress(null);
    setLastRunStatus(null);

    try {
      for (let i = 0; i < commands.length; i += 1) {
        const rawCommand = commands[i];
        setRunProgress(`[${i + 1}/${commands.length}] ${rawCommand}`);

        const [commandPart, payloadPart] = rawCommand.split('=');
        const command = (commandPart ?? '').trim().toUpperCase();
        const payload = (payloadPart ?? '').trim();

        let executed = false;
        let requiresRobotIdle = false;
        if (command === 'POSE') {
          if (payload) {
            executed = await executePoseCommand(payload);
            requiresRobotIdle = executed;
          } else {
            setLastRunStatus(`POSE 명령에 포즈 이름이 필요합니다. 건너뜀`);
          }
        } else if (command === 'MARKER') {
          if (payload) {
            executed = await executeMarkerCommand(payload);
            requiresRobotIdle = executed;
          } else {
            setLastRunStatus('MARKER 명령에 ID가 필요합니다. 건너뜀');
          }
        } else if (command === 'DOWN' || command === 'UP') {
          const override =
            Number.isFinite(Number(payload)) && Number(payload) > 0
              ? Number(payload)
              : undefined;
          const distance = override ?? gripDepthMm;
          const signedDistance = command === 'DOWN' ? distance : -distance;
          executed = await executeDownCommand(signedDistance);
          requiresRobotIdle = executed;
        } else if (command === 'FRONT' || command === 'BACK' || command === 'LEFT' || command === 'RIGHT') {
          const distanceMm =
            Number.isFinite(Number(payload)) && Number(payload) > 0
              ? Number(payload)
              : gripDepthMm;
          const distanceMeters = distanceMm / 1000;
          let delta: Vector3 | null = null;
          switch (command) {
            case 'FRONT':
              delta = new Vector3(distanceMeters, 0, 0);
              break;
            case 'BACK':
              delta = new Vector3(-distanceMeters, 0, 0);
              break;
            case 'LEFT':
              delta = new Vector3(0, distanceMeters, 0);
              break;
            case 'RIGHT':
              delta = new Vector3(0, -distanceMeters, 0);
              break;
            case 'UP':
              delta = new Vector3(0, 0, distanceMeters);
              break;
            default:
              break;
          }
          if (delta) {
            const result = moveIkTarget(delta);
            if (!result) {
              setLastRunStatus('FRONT/BACK/LEFT/RIGHT/UP 명령에 필요한 IK 정보를 찾지 못했습니다. 건너뜀');
            } else {
              const { nextWorld, rosDelta } = result;
              setIkWorldPosition([nextWorld.x, nextWorld.y, nextWorld.z]);
              setIkOffsetX(rosDelta.x);
              setIkOffsetY(rosDelta.z);
              setIkOffsetZ(rosDelta.y);
              try {
                await performIkAutoSolve();
                const controls = useRobotControlStore.getState();
                await pushTargetJoints(controls.jointAnglesDeg, {
                  velocity: controls.jointVelocity,
                  acceleration: controls.jointAcceleration,
                  mode: 1,
                });
                executed = true;
                requiresRobotIdle = true;
              } catch (error) {
                setLastRunStatus(error instanceof Error ? error.message : `${command} IK 실패`);
              }
            }
          }
        } else if (command === 'DELAY') {
          const seconds = Number(payload);
          if (Number.isFinite(seconds) && seconds > 0) {
            await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
            executed = true;
          } else {
            setLastRunStatus('DELAY 명령에는 양의 숫자(초)가 필요합니다. 건너뜀');
          }
        } else if (command === 'GRIP') {
          try {
            await pulseGripper('grip');
            await waitForIdle('그리퍼 실행', { check: 'gripper' });
            executed = true;
          } catch (error) {
            setLastRunStatus(
              error instanceof Error ? error.message : '그리퍼 명령 실패'
            );
          }
        } else if (command === 'RELEASE') {
          try {
            await pulseGripper('release');
            await waitForIdle('그리퍼 실행', { check: 'gripper' });
            executed = true;
          } catch (error) {
            setLastRunStatus(
              error instanceof Error ? error.message : '그리퍼 명령 실패'
            );
          }
        } else if (command.length > 0) {
          setLastRunStatus(`지원하지 않는 명령입니다: ${command}. 건너뜀`);
        }

        if (requiresRobotIdle) {
          await waitForIdle('명령 실행');
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      setLastRunStatus(`'${activeSequence.name}' 시퀀스를 완료했습니다.`);
    } catch (error) {
      setLastRunStatus(
        error instanceof Error ? error.message : '시퀀스 실행 중 오류가 발생했습니다.'
      );
    } finally {
      setIsRunning(false);
      setRunProgress(null);
    }
  }, [activeSequence, executePoseCommand, waitForIdle]);

  return (
    <div className="h-full flex flex-col bg-neutral-900 text-neutral-100">
      <header className="px-6 pt-6 pb-4 border-b border-neutral-800">
        <h2 className="text-xl font-semibold tracking-tight">시퀀스 제작</h2>
        <p className="text-sm text-neutral-400 mt-1">
          시퀀스를 Next.js 내부 저장소에 보관하고, 필요할 때 즉시 실행할 수 있습니다.
        </p>
      </header>

      <div className="flex flex-col gap-4 px-6 py-6">
        <div className="flex gap-3">
          <input
            type="text"
            value={newFileName}
            onChange={(event) => setNewFileName(event.target.value)}
            placeholder="새 시퀀스 이름"
            className="flex-1 rounded-lg border border-neutral-700 bg-neutral-950/60 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
          />
          <button
            type="button"
            onClick={handleCreate}
            className="rounded-full border border-neutral-700 bg-neutral-900/80 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-neutral-100 transition hover:border-emerald-400 hover:text-emerald-200"
          >
            새 파일
          </button>
        </div>

        {sequences.length === 0 && (
          <div className="rounded-2xl border border-dashed border-neutral-700 p-6 text-center text-sm text-neutral-500">
            저장된 시퀀스가 없습니다. 위 입력창에서 새 시퀀스를 생성해 주세요.
          </div>
        )}

        {sequences.length > 0 && !activeSequence && (
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-6 text-center text-sm text-neutral-400">
            좌측 목록에서 편집할 시퀀스를 선택해 주세요.
          </div>
        )}

        {sequences.length > 0 && (
          <div className="flex flex-1 gap-4">
            <aside className="w-48 border border-neutral-800 rounded-2xl bg-neutral-950/50 overflow-auto">
              <ul className="divide-y divide-neutral-800">
                {sequences.map((seq) => {
                  const isActive = seq.id === activeSequence?.id;
                  return (
                    <li key={seq.id}>
                      <button
                        type="button"
                        onClick={() => setActiveSequence(seq.id)}
                        className={`w-full px-3 py-2 text-left text-sm transition ${
                          isActive
                            ? 'bg-neutral-900 text-neutral-50'
                            : 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-900/60'
                        }`}
                      >
                        <div className="truncate font-semibold">{seq.name}</div>
                        <div className="text-[10px] text-neutral-500">
                          {new Date(seq.updatedAt).toLocaleTimeString()}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </aside>

            {activeSequence && (
              <div className="flex-1 space-y-3">
              <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={handleDelete}
                  disabled={isRunning}
                  className="rounded-full border border-rose-500 bg-rose-500/80 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-neutral-900 transition hover:bg-rose-400 disabled:opacity-40"
                  >
                    삭제
                  </button>
                  <button
                    type="button"
                  onClick={() => {
                    void handleRun();
                  }}
                  disabled={isRunning}
                  className="rounded-full border border-emerald-500 bg-emerald-500 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-neutral-900 transition hover:bg-emerald-400 hover:border-emerald-400 disabled:opacity-40"
                  >
                  {isRunning ? '실행 중…' : '실행'}
                  </button>
                </div>

                <input
                  type="text"
                  value={renameValue}
                  onChange={(event) => handleRename(event.target.value)}
                  placeholder="시퀀스 이름"
                  className="rounded-lg border border-neutral-700 bg-neutral-950/60 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                />

                <textarea
                  value={activeSequence?.content ?? ''}
                  onChange={(event) => handleContentChange(event.target.value)}
                  placeholder={`예)\nMOVE pose_A\nGRIP close\nMOVE pose_B`}
                  className="h-64 rounded-2xl border border-neutral-800 bg-neutral-950/60 px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            )}
          </div>
        )}

        {runProgress && <p className="text-xs text-emerald-300">{runProgress}</p>}
        {lastRunStatus && (
          <p className="text-xs text-neutral-400">{lastRunStatus}</p>
        )}
      </div>
    </div>
  );
}




