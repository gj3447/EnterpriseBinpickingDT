"use client";

import { Suspense, useState, useEffect, useMemo, useCallback } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import URDFLoader, { URDFRobot } from 'urdf-loader';
import { ColladaLoader } from 'three-stdlib';
import useWebSocket, { ReadyState } from 'react-use-websocket';
import * as THREE from 'three';

import { WebsocketData } from '@/components/dt/types';
import { Loader } from '@/components/dt/Loader';
import { RobotScene } from '@/components/dt/RobotScene';
import { degreesToRadians, useRobotControlStore } from '@/stores/robotControlStore';
import { useOpcUaStore } from '@/stores/opcUaStore';
import { useTransformStore } from '@/stores/transformStore';
import { appConfig } from '@/config';
import { StreamConnectionBadge } from '@/components/dt/StreamConnectionBadge';
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

const TRANSFORMS_WS_URL = appConfig.streams.urls.transforms;
const TRANSFORM_RECONNECT_INTERVAL_MS = appConfig.streams.reconnectIntervalMs;

function SceneContent() {
    const [transformData, setTransformData] = useState<WebsocketData | null>(null);
    const { lastJsonMessage, readyState } = useWebSocket(TRANSFORMS_WS_URL, {
        onOpen: () => console.log('WebSocket connection established.'),
        onClose: () => console.log('WebSocket connection closed.'),
        onError: (event) => console.error('WebSocket error:', event),
        shouldReconnect: () => true,
        reconnectInterval: TRANSFORM_RECONNECT_INTERVAL_MS,
    });
    const setConnectionState = useTransformStore((state) => state.setConnectionState);
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
        if (readyState === undefined) {
            return;
        }
        const state =
            readyState === ReadyState.OPEN
                ? 'open'
                : readyState === ReadyState.CLOSED || readyState === ReadyState.CLOSING
                ? 'closed'
                : 'connecting';
        setConnectionState(state);
    }, [readyState, setConnectionState]);

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
        <StreamConnectionBadge />
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
  const commandStatus = useOpcUaStore((state) => state.status.commandStatus);
  const gripperIn1 = useOpcUaStore((state) => state.status.gripperIn1);
  const gripperSyncState = useOpcUaStore((state) => state.status.gripperSyncState);
  const setJointAnglesDeg = useRobotControlStore((state) => state.setJointAnglesDeg);
  const setManualEnabled = useRobotControlStore((state) => state.setManualEnabled);
  const [pullLoading, setPullLoading] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [gripLoading, setGripLoading] = useState(false);
  const [releaseLoading, setReleaseLoading] = useState(false);

  const handlePull = useCallback(async () => {
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
      } else {
        console.warn('[PULL] currentJoints value unavailable.');
      }
    } catch (error) {
      console.error('[PULL] Failed to fetch/apply status:', error);
    } finally {
      setPullLoading(false);
    }
  }, [fetchStatus, setJointAnglesDeg, setManualEnabled]);

  const handlePush = useCallback(async () => {
    setPushLoading(true);
    try {
      const state = useRobotControlStore.getState();
      const dtAngles = state.jointAnglesDeg;
      const velocity = state.jointVelocity;
      const acceleration = state.jointAcceleration;
      await pushTargetJoints(dtAngles, { velocity, acceleration, mode: 1 });
    } catch (error) {
      console.error('[PUSH] Failed to push target joints:', error);
    } finally {
      setPushLoading(false);
    }
  }, [pushTargetJoints]);

  const handleGrip = useCallback(async () => {
    setGripLoading(true);
    try {
      await pulseGripper('grip');
    } catch (error) {
      console.error('[GRIP] Failed to trigger gripper:', error);
    } finally {
      setGripLoading(false);
    }
  }, [pulseGripper]);

  const handleRelease = useCallback(async () => {
    setReleaseLoading(true);
    try {
      await pulseGripper('release');
    } catch (error) {
      console.error('[RELEASE] Failed to trigger gripper release:', error);
    } finally {
      setReleaseLoading(false);
    }
  }, [pulseGripper]);

  const gripperOpenActive = gripperIn1 === true;
  const gripperCloseActive = gripperIn1 === false;
  const syncStopActive = gripperSyncState === true;
  const syncMoveActive = gripperSyncState === false;
  const robotMovingActive = commandStatus === 4;
  const robotIdleActive = commandStatus !== 4;

  const pillBase =
    'px-3 py-1 text-[11px] font-semibold uppercase tracking-wider rounded-full border transition-colors';
  const openClass = gripperOpenActive
    ? `${pillBase} border-emerald-400/60 bg-emerald-500/15 text-emerald-200`
    : `${pillBase} border-neutral-800 bg-neutral-900/60 text-neutral-500`;
  const closeClass = gripperCloseActive
    ? `${pillBase} border-rose-400/60 bg-rose-500/15 text-rose-200`
    : `${pillBase} border-neutral-800 bg-neutral-900/60 text-neutral-500`;
  const syncStopClass = syncStopActive
    ? `${pillBase} border-sky-400/60 bg-sky-500/15 text-sky-200`
    : `${pillBase} border-neutral-800 bg-neutral-900/60 text-neutral-500`;
  const syncMoveClass = syncMoveActive
    ? `${pillBase} border-amber-400/60 bg-amber-500/15 text-amber-200`
    : `${pillBase} border-neutral-800 bg-neutral-900/60 text-neutral-500`;
  const robotIdleClass = robotIdleActive
    ? `${pillBase} border-blue-400/60 bg-blue-500/15 text-blue-200`
    : `${pillBase} border-neutral-800 bg-neutral-900/60 text-neutral-500`;
  const robotMoveClass = robotMovingActive
    ? `${pillBase} border-purple-400/60 bg-purple-500/15 text-purple-200`
    : `${pillBase} border-neutral-800 bg-neutral-900/60 text-neutral-500`;

  return (
    <div className="pointer-events-auto w-[280px] rounded-2xl border border-neutral-800/80 bg-neutral-950/80 px-4 py-4 text-neutral-100 shadow-xl shadow-black/30 backdrop-blur-sm">
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-tight text-neutral-50">로봇 액션 흐름</h3>
        <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-neutral-600">모킹</span>
      </header>
      <div className="mt-4 space-y-4 text-[11px] text-neutral-300">
        <section className="rounded-2xl border border-neutral-800/70 bg-neutral-900/60 px-4 py-4">
          <div className="flex items-center justify-between text-neutral-400 uppercase tracking-widest">
            <span>로봇 동작</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void handlePull()}
              disabled={pullLoading || opcLoading}
              className="rounded-xl border border-neutral-800/80 bg-neutral-900/70 px-3 py-3 text-center text-lg font-semibold uppercase tracking-wide text-neutral-50 transition hover:border-emerald-500/50 disabled:opacity-40"
            >
              {pullLoading ? 'PULL…' : 'PULL'}
            </button>
            <button
              type="button"
              onClick={() => void handlePush()}
              disabled={pushLoading || opcLoading}
              className="rounded-xl border border-neutral-800/80 bg-neutral-900/70 px-3 py-3 text-center text-lg font-semibold uppercase tracking-wide text-neutral-50 transition hover:border-emerald-500/50 disabled:opacity-40"
            >
              {pushLoading ? 'PUSH…' : 'PUSH'}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-2">
            <span className={robotIdleClass}>정지</span>
            <span className={robotMoveClass}>움직임</span>
          </div>
        </section>

        <section className="rounded-2xl border border-neutral-800/70 bg-neutral-900/60 px-4 py-4 space-y-3">
          <div className="flex items-center justify-between text-neutral-400 uppercase tracking-widest">
            <span>그리퍼 동작</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void handleGrip()}
              disabled={gripLoading || opcLoading}
              className="rounded-xl border border-neutral-800/80 bg-neutral-900/70 px-3 py-3 text-center text-lg font-semibold uppercase tracking-wide text-neutral-50 transition hover:border-emerald-500/50 disabled:opacity-40"
            >
              {gripLoading ? 'GRIP…' : 'GRIP'}
            </button>
            <button
              type="button"
              onClick={() => void handleRelease()}
              disabled={releaseLoading || opcLoading}
              className="rounded-xl border border-neutral-800/80 bg-neutral-900/70 px-3 py-3 text-center text-lg font-semibold uppercase tracking-wide text-neutral-50 transition hover:border-emerald-500/50 disabled:opacity-40"
            >
              {releaseLoading ? 'RELEASE…' : 'RELEASE'}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-2">
            <span className={openClass}>열림</span>
            <span className={closeClass}>닫힘</span>
            <span className={syncStopClass}>정지</span>
            <span className={syncMoveClass}>움직임</span>
          </div>
        </section>
      </div>
    </div>
  );
}
