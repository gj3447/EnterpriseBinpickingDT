"use client";

import { Suspense, useMemo, useState, useEffect } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import URDFLoader, { URDFRobot } from 'urdf-loader';
import { ColladaLoader } from 'three-stdlib';
import useWebSocket from 'react-use-websocket';
import * as THREE from 'three';

import { WebsocketData } from '@/components/dt/types';
import { Loader } from '@/components/dt/Loader';
import { RobotScene } from '@/components/dt/RobotScene';

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

export function MultiRobotViewer() {
    const [transformData, setTransformData] = useState<WebsocketData | null>(null);
    const { lastJsonMessage } = useWebSocket('ws://192.168.0.196:53000/ws/transforms_robot', {
        onOpen: () => console.log('WebSocket connection established.'),
        onClose: () => console.log('WebSocket connection closed.'),
        onError: (event) => console.error('WebSocket error:', event),
        shouldReconnect: () => true,
        reconnectInterval: 1000,
    });

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

    const robotPositions = useMemo(() => {
        const positions: [number, number, number][] = [];
        const gridSize = 10;
        const spacing = 2;
        const offset = (gridSize - 1) * spacing / 2;

        for (let i = 0; i < gridSize; i++) {
          for (let j = 0; j < gridSize; j++) {
            const x = i * spacing - offset;
            const z = j * spacing - offset;
            positions.push([x, 0, z]);
          }
        }
        return positions;
    }, []);

    const canvasGridSize = 22;

    return (
        <div className="w-full h-full cursor-grab active:cursor-grabbing">
            <Canvas camera={{ position: [15, 15, 15], fov: 50 }} shadows>
                <color attach="background" args={["#e0e0e0"]} />
                <ambientLight intensity={0.8} />
                <directionalLight
                    position={[10, 20, 15]}
                    intensity={1.2}
                    castShadow
                    shadow-mapSize-width={2048}
                    shadow-mapSize-height={2048}
                />
                <Suspense fallback={<Loader />}>
                    {robotModel && transformData ? (
                        robotPositions.map((pos, i) => (
                            <RobotScene
                                key={i}
                                basePosition={pos}
                                transformData={transformData}
                                robotModel={robotModel}
                            />
                        ))
                    ) : (
                        <Loader />
                    )}
                </Suspense>
                <OrbitControls minDistance={1} maxDistance={50} />
                <gridHelper args={[canvasGridSize * 2, canvasGridSize * 2]} />
            </Canvas>
        </div>
    );
}
