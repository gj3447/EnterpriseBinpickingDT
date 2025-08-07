"use client";

import * as THREE from 'three';
import { Suspense } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import URDFLoader, { URDFRobot } from 'urdf-loader';
import { ColladaLoader } from 'three-stdlib';

function RobotModel({ url }: { url: string }) {
  const robot = useLoader(URDFLoader, url, (loader) => {
    loader.packages = {
        'dsr_description2': '/urdf/dsr_description2'
    };
    loader.loadMeshCb = (path, manager, onComplete) => {
      const colladaLoader = new ColladaLoader(manager);
      colladaLoader.load(
        path,
        (collada) => {
          onComplete(collada.scene);
        },
        undefined,
        (err) => {
          console.error(`Failed to load mesh: ${path}`, err);
          onComplete(new THREE.Group());
        }
      );
    };
  }) as URDFRobot;

  return <primitive object={robot} rotation={[-Math.PI / 2, 0, 0]} />;
}

function Loader() {
    return (
        <Html center>
            <div className="text-lg text-gray-800 dark:text-gray-100 font-semibold">
                로봇 모델을 불러오는 중...
            </div>
        </Html>
    );
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
            <RobotModel url="/urdf/dsr_description2/urdf/a0509.urdf" />
        </Suspense>
        <OrbitControls minDistance={0.5} maxDistance={5} />
        
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
          <planeGeometry args={[20, 20]} />
          <shadowMaterial opacity={0.3} />
        </mesh>
        <gridHelper args={[20, 20]} />
      </Canvas>
    </div>
  );
}

