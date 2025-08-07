"use client";

import * as THREE from 'three';
import { Suspense, useMemo } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import URDFLoader, { URDFRobot } from 'urdf-loader';
import { ColladaLoader, SkeletonUtils } from 'three-stdlib';

function Loader() {
    return (
        <Html center>
            <div className="text-lg text-gray-800 dark:text-gray-100 font-semibold">
                로봇 모델을 불러오는 중...
            </div>
        </Html>
    );
}

interface RobotInstancesProps {
    robotPositions: [number, number, number][];
}

function RobotInstances({ robotPositions }: RobotInstancesProps) {
    const robot = useLoader(URDFLoader, "/urdf/dsr_description2/urdf/a0509.urdf", (loader) => {
        loader.packages = {
            'dsr_description2': '/urdf/dsr_description2'
        };
        loader.loadMeshCb = (path, manager, onComplete) => {
            const colladaLoader = new ColladaLoader(manager);
            colladaLoader.load(path, (collada) => onComplete(collada.scene), undefined, (err) => {
                console.error(`Failed to load mesh: ${path}`, err);
                onComplete(new THREE.Group());
            });
        };
    }) as URDFRobot;

    const clones = useMemo(() => 
        robotPositions.map(() => SkeletonUtils.clone(robot)), 
        [robot, robotPositions]
    );

    return (
        <>
            {clones.map((clone, i) => (
                <primitive
                    key={i}
                    object={clone}
                    position={robotPositions[i]}
                    rotation={[-Math.PI / 2, 0, 0]}
                />
            ))}
        </>
    );
}

interface MultiRobotViewerProps {
    robotPositions: [number, number, number][];
}

export function MultiRobotViewer({ robotPositions }: MultiRobotViewerProps) {
    const gridSize = 22; // 10x10 grid with 2m spacing + buffer
    return (
        <div className="w-full h-full cursor-grab active:cursor-grabbing">
            <Canvas camera={{ position: [15, 15, 15], fov: 50 }} shadows>
                <color attach="background" args={["#e0e0e0"]} />
                <ambientLight intensity={0.5} />
                <directionalLight
                    position={[20, 30, 25]}
                    intensity={1.5}
                    castShadow
                    shadow-mapSize-width={4096}
                    shadow-mapSize-height={4096}
                />
                <Suspense fallback={<Loader />}>
                    <RobotInstances robotPositions={robotPositions} />
                </Suspense>
                <OrbitControls minDistance={1} maxDistance={50} />
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
                    <planeGeometry args={[gridSize * 2, gridSize * 2]} />
                    <shadowMaterial opacity={0.3} />
                </mesh>
                <gridHelper args={[gridSize * 2, gridSize * 2]} />
            </Canvas>
        </div>
    );
}

