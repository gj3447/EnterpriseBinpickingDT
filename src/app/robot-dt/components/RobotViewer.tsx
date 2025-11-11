"use client";

import { Suspense, useState, useEffect, useMemo, useCallback } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import URDFLoader, { URDFRobot } from 'urdf-loader';
import { ColladaLoader } from 'three-stdlib';
import useWebSocket from 'react-use-websocket';
import * as THREE from 'three';

import { WebsocketData } from '@/components/dt/types';
import { Loader } from '@/components/dt/Loader';
import { RobotScene } from '@/components/dt/RobotScene';
import { degreesToRadians, useRobotControlStore } from '@/stores/robotControlStore';
import { useOpcUaStore } from '@/stores/opcUaStore';
import { RobotCameraPanel } from './RobotCameraPanel';
import { RobotPosePanel } from './RobotPosePanel';

const isWebsocketData = (value: unknown): value is WebsocketData => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<WebsocketData>;
  return (
    typeof candidate.frame === 'string' &&
    candidate.board !== undefined &&
    candidate.robot !== undefined
  );
};

function SceneContent() {
    const [transformData, setTransformData] = useState<WebsocketData | null>(null);
    const { lastJsonMessage } = useWebSocket('ws://192.168.0.196:53000/ws/transforms_robot', {
        onOpen: () => console.log('WebSocket connection established.'),
        onClose: () => console.log('WebSocket connection closed.'),
        onError: (event) => console.error('WebSocket error:', event),
        shouldReconnect: () => true,
        reconnectInterval: 1000,
    });
    const manualEnabled = useRobotControlStore((state) => state.manualEnabled);
    const jointAnglesDeg = useRobotControlStore((state) => state.jointAnglesDeg);
    const manualJointAnglesRad = useMemo(
        () => jointAnglesDeg.map((angle) => degreesToRadians(angle)),
        [jointAnglesDeg]
    );
    const fallbackTransformData = useMemo<WebsocketData>(
        () => ({
            frame: 'manual',
            board_detected: false,
            board: {
                translation: [0, 0, 0],
                orientation_quaternion: [0, 0, 0, 1],
            },
            robot: {
                translation: [0, 0, 0],
                orientation_quaternion: [0, 0, 0, 1],
            },
            camera: {
                translation: [0.5, -0.5, 0.5],
                orientation_quaternion: [0, 0, 0, 1],
            },
            external_markers: [],
        }),
        []
    );

    useEffect(() => {
        if (isWebsocketData(lastJsonMessage)) {
            setTransformData(lastJsonMessage);
        }
    }, [lastJsonMessage]);

    const robotModel = useLoader<URDFRobot, string>(
      URDFLoader,
      "/urdf/dsr_description2/urdf/a0509.urdf",
      (loader) => {
        loader.packages = {
            'dsr_description2': '/urdf/dsr_description2'
        };
        loader.loadMeshCb = (path: string, manager: THREE.LoadingManager, onComplete: (scene: THREE.Group) => void) => {
            const colladaLoader = new ColladaLoader(manager);
            colladaLoader.load(
              path,
              (collada: { scene: THREE.Group }) => onComplete(collada.scene),
              undefined,
              (err: unknown) => {
                console.error(`Failed to load mesh: ${path}`, err);
                onComplete(new THREE.Group());
              }
            );
        };
      }
    );

    const activeTransformData = transformData ?? (manualEnabled ? fallbackTransformData : null);

    if (!activeTransformData || !robotModel) {
        return <Loader />;
    }

    return (
        <RobotScene
            transformData={activeTransformData}
            robotModel={robotModel}
            manualEnabled={manualEnabled}
            manualJointAnglesRad={manualJointAnglesRad}
        />
    );
}

export function RobotViewer() {
  return (
    <div className="relative h-full w-full bg-neutral-950">
      <div className="h-full w-full cursor-grab active:cursor-grabbing">
        <Canvas camera={{ position: [1.5, 1.5, 1.5], fov: 50 }} shadows>
          <color attach="background" args={["#e0e0e0"]} />
          <ambientLight intensity={0.5} />
          <directionalLight
            position={[5, 10, 7.5]}
            intensity={1.5}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
          />
          <Suspense fallback={<Loader />}>
            <SceneContent />
          </Suspense>
          <OrbitControls minDistance={0.5} maxDistance={5} />
          <gridHelper args={[20, 20]} />
        </Canvas>
      </div>
      <ViewerOverlay />
    </div>
  );
}

function ViewerOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 flex justify-between">
      <PoseManagerDock />
      <div className="pointer-events-auto flex flex-col gap-3 p-4 items-end">
        <RobotCameraPanel variant="overlay" />
        <ActionSummaryCard />
      </div>
    </div>
  );
}

function PoseManagerDock() {
  return (
    <div className="pointer-events-auto flex h-full items-start p-4">
      <div className="h-[calc(100vh-2rem)] w-[320px] max-w-[85vw] overflow-hidden">
        <RobotPosePanel />
      </div>
    </div>
  );
}

function ActionSummaryCard() {
  const opcLoading = useOpcUaStore((state) => state.loading);
  const fetchStatus = useOpcUaStore((state) => state.fetchStatus);
  const pushTargetJoints = useOpcUaStore((state) => state.pushTargetJoints);
  const pulseGripper = useOpcUaStore((state) => state.pulseGripper);
  const setJointAnglesDeg = useRobotControlStore((state) => state.setJointAnglesDeg);
  const setManualEnabled = useRobotControlStore((state) => state.setManualEnabled);
  const [pullLoading, setPullLoading] = useState(false);
  const [pullFeedback, setPullFeedback] = useState<string | null>(null);
  const [pushLoading, setPushLoading] = useState(false);
  const [gripLoading, setGripLoading] = useState(false);
  const [releaseLoading, setReleaseLoading] = useState(false);
  const [pushFeedback, setPushFeedback] = useState<string | null>(null);
  const [gripFeedback, setGripFeedback] = useState<string | null>(null);
  const [releaseFeedback, setReleaseFeedback] = useState<string | null>(null);

  const handlePull = useCallback(async () => {
    setPullFeedback(null);
    setPullLoading(true);
    try {
      console.log('[PULL] Fetching OPC status…');
      await fetchStatus();
      const { status } = useOpcUaStore.getState();
      const latestJoints = status.currentJoints;
      console.log('[PULL] OPC status currentJoints:', latestJoints);
      if (latestJoints && latestJoints.length > 0) {
        setJointAnglesDeg(latestJoints);
        setManualEnabled(true);
        console.log('[PULL] Applied to DT (deg):', latestJoints);
        setPullFeedback('실제 로봇 관절 각도를 디지털 트윈에 적용했습니다.');
      } else {
        console.warn('[PULL] currentJoints value unavailable.');
        setPullFeedback('조인트 값을 불러오지 못했습니다. 잠시 후 다시 시도하세요.');
      }
    } catch (error) {
      console.error('[PULL] Failed to fetch/apply status:', error);
      setPullFeedback(error instanceof Error ? error.message : 'Pull 작업에 실패했습니다.');
    } finally {
      setPullLoading(false);
    }
  }, [fetchStatus, setJointAnglesDeg, setManualEnabled]);

  const handlePush = useCallback(async () => {
    setPushFeedback(null);
    setPushLoading(true);
    try {
      const state = useRobotControlStore.getState();
      const dtAngles = state.jointAnglesDeg;
      const velocity = state.jointVelocity;
      const acceleration = state.jointAcceleration;
      await pushTargetJoints(dtAngles, { velocity, acceleration, mode: 1 });
      setPushFeedback('디지털 트윈 관절 값을 OPC UA로 전송했습니다.');
    } catch (error) {
      console.error('[PUSH] Failed to push target joints:', error);
      setPushFeedback(error instanceof Error ? error.message : 'Push 작업에 실패했습니다.');
    } finally {
      setPushLoading(false);
    }
  }, [pushTargetJoints]);

  const handleGrip = useCallback(async () => {
    setGripFeedback(null);
    setGripLoading(true);
    try {
      await pulseGripper('grip');
      setGripFeedback('그리퍼 그립 명령을 전송했습니다.');
    } catch (error) {
      console.error('[GRIP] Failed to trigger gripper:', error);
      setGripFeedback(error instanceof Error ? error.message : 'Grip 동작에 실패했습니다.');
    } finally {
      setGripLoading(false);
    }
  }, [pulseGripper]);

  const handleRelease = useCallback(async () => {
    setReleaseFeedback(null);
    setReleaseLoading(true);
    try {
      await pulseGripper('release');
      setReleaseFeedback('그리퍼 릴리즈 명령을 전송했습니다.');
    } catch (error) {
      console.error('[RELEASE] Failed to trigger gripper release:', error);
      setReleaseFeedback(error instanceof Error ? error.message : 'Release 동작에 실패했습니다.');
    } finally {
      setReleaseLoading(false);
    }
  }, [pulseGripper]);

  const ACTIONS: Array<{
    key: 'pull' | 'push' | 'grip' | 'release';
    label: string;
    onClick: () => void;
    disabled?: boolean;
    loading?: boolean;
    feedback: string | null;
  }> = [
    {
      key: 'pull',
      label: 'PULL',
      onClick: () => void handlePull(),
      disabled: pullLoading || opcLoading,
      loading: pullLoading,
      feedback: pullFeedback,
    },
    {
      key: 'push',
      label: 'PUSH',
      onClick: () => void handlePush(),
      disabled: pushLoading || opcLoading,
      loading: pushLoading,
      feedback: pushFeedback,
    },
    {
      key: 'grip',
      label: 'GRIP',
      onClick: () => void handleGrip(),
      disabled: gripLoading || opcLoading,
      loading: gripLoading,
      feedback: gripFeedback,
    },
    {
      key: 'release',
      label: 'RELEASE',
      onClick: () => void handleRelease(),
      disabled: releaseLoading || opcLoading,
      loading: releaseLoading,
      feedback: releaseFeedback,
    },
  ];

  return (
    <div className="pointer-events-auto w-[280px] rounded-2xl border border-neutral-800/80 bg-neutral-950/80 px-4 py-4 text-neutral-100 shadow-xl shadow-black/30 backdrop-blur-sm">
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-tight text-neutral-50">로봇 액션 흐름</h3>
        <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-neutral-600">모킹</span>
      </header>
      <p className="mt-2 text-[11px] leading-relaxed text-neutral-400">
        UI만 제공되며 실제 명령은 연결되어 있지 않습니다. 각 액션의 데이터 흐름을 참고하세요.
      </p>
      <div className="mt-4 space-y-3 text-[11px] text-neutral-300">
        {ACTIONS.map((action) => (
          <div key={action.key}>
            <button
              type="button"
              onClick={action.onClick}
              disabled={action.disabled}
              className="w-full rounded-2xl border border-neutral-800/80 bg-neutral-900/70 px-4 py-5 text-center text-2xl font-semibold uppercase tracking-wide text-neutral-50 transition hover:border-emerald-500/50 disabled:opacity-40"
            >
              {action.loading ? `${action.label}…` : action.label}
            </button>
            {action.feedback && (
              <p className="mt-2 text-[11px] leading-relaxed text-neutral-400">{action.feedback}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
