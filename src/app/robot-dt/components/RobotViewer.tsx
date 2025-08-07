"use client";

import { Suspense, useState, useEffect } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import URDFLoader, { URDFRobot } from 'urdf-loader';
import { ColladaLoader } from 'three-stdlib';
import useWebSocket from 'react-use-websocket';
import * as THREE from 'three';

import { WebsocketData } from '@/components/dt/types';
import { Loader } from '@/components/dt/Loader';
import { RobotScene } from '@/components/dt/RobotScene';

function SceneContent() {
    const [transformData, setTransformData] = useState<WebsocketData | null>(null);
    const { lastJsonMessage } = useWebSocket('ws://192.168.0.196:52000/ws/transforms_robot', {
        onOpen: () => console.log('WebSocket connection established.'),
        onClose: () => console.log('WebSocket connection closed.'),
        onError: (event) => console.error('WebSocket error:', event),
        shouldReconnect: (closeEvent) => true,
    });

    useEffect(() => {
        if (lastJsonMessage) {
            setTransformData(lastJsonMessage as WebsocketData);
        }
    }, [lastJsonMessage]);

    const robotModel = useLoader(URDFLoader as any, "/urdf/dsr_description2/urdf/a0509.urdf", (loader: any) => {
        loader.packages = {
            'dsr_description2': '/urdf/dsr_description2'
        };
        loader.loadMeshCb = (path: string, manager: THREE.LoadingManager, onComplete: (scene: THREE.Group) => void) => {
            const colladaLoader = new ColladaLoader(manager);
            colladaLoader.load(path, (collada) => onComplete(collada.scene as any), undefined, (err) => {
                console.error(`Failed to load mesh: ${path}`, err);
                onComplete(new THREE.Group());
            });
        };
    }) as URDFRobot;

    if (!transformData || !robotModel) {
        return <Loader />;
    }

    return <RobotScene transformData={transformData} robotModel={robotModel} />;
}

export function RobotViewer() {
  return (
    <div className="w-full h-full cursor-grab active:cursor-grabbing">
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
  );
}
