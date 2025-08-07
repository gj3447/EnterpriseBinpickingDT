"use client";

import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";

const LAYER_COUNT = 8;
const LAYER_SEPARATION = 3.5;
const PLANE_WIDTH = 14;
const PLANE_HEIGHT = 14;
const NEURON_GRID_SIZE = 14; 

function getNeuronPosition(index: number): [number, number] {
    const x = (index % NEURON_GRID_SIZE) - (NEURON_GRID_SIZE - 1) / 2;
    const y = Math.floor(index / NEURON_GRID_SIZE) - (NEURON_GRID_SIZE - 1) / 2;
    return [x * (PLANE_WIDTH / NEURON_GRID_SIZE), y * (PLANE_HEIGHT / NEURON_GRID_SIZE)];
}

function NeuronGrid() {
  const count = NEURON_GRID_SIZE * NEURON_GRID_SIZE;

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        const [x, y] = getNeuronPosition(i);
        pos[i * 3] = x;
        pos[i * 3 + 1] = y;
        pos[i * 3 + 2] = 0;
    }
    return pos;
  }, []);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial size={0.08} color="#333333" />
    </points>
  );
}


function LayerPlane() {
  return (
    <mesh>
      <planeGeometry args={[PLANE_WIDTH, PLANE_HEIGHT]} />
       <meshBasicMaterial
        color="#000000"
        transparent
        opacity={0.05}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function DynamicConnections() {
    const lineCount = 100;
    const geomRef = useRef<THREE.BufferGeometry>(null!);

    const connections = useMemo(() => 
        Array.from({ length: lineCount }, () => ({
            progress: Math.random(),
            speed: 0.005 + Math.random() * 0.01,
            startNeuron: 0,
            endNeuron: 0,
            startLayer: 0,
            endLayer: 0,
            opacity: 0,
        })), [lineCount]);
    
    useFrame(() => {
        if (!geomRef.current) return;
        const positions = geomRef.current.attributes.position.array as Float32Array;
        const opacities = geomRef.current.attributes.opacity.array as Float32Array;

        connections.forEach((conn, i) => {
            conn.progress += conn.speed;
            
            if (conn.progress > 1) {
                conn.progress = 0;
                conn.startLayer = Math.floor(Math.random() * (LAYER_COUNT - 1));
                conn.endLayer = conn.startLayer + 1;
                conn.startNeuron = Math.floor(Math.random() * (NEURON_GRID_SIZE * NEURON_GRID_SIZE));
                conn.endNeuron = Math.floor(Math.random() * (NEURON_GRID_SIZE * NEURON_GRID_SIZE));
            }
            
            const [startX, startZ] = getNeuronPosition(conn.startNeuron);
            const startY = (conn.startLayer - (LAYER_COUNT - 1) / 2) * LAYER_SEPARATION;
            
            const [endX, endZ] = getNeuronPosition(conn.endNeuron);
            const endY = (conn.endLayer - (LAYER_COUNT - 1) / 2) * LAYER_SEPARATION;

            positions[i * 6] = startX;
            positions[i * 6 + 1] = startY;
            positions[i * 6 + 2] = startZ;
            positions[i * 6 + 3] = endX;
            positions[i * 6 + 4] = endY;
            positions[i * 6 + 5] = endZ;
            
            conn.opacity = Math.sin(conn.progress * Math.PI);
            opacities[i * 2] = conn.opacity;
            opacities[i * 2 + 1] = conn.opacity;
        });

        geomRef.current.attributes.position.needsUpdate = true;
        geomRef.current.attributes.opacity.needsUpdate = true;
    });

    const initialPositions = new Float32Array(lineCount * 3 * 2);
    const initialOpacities = new Float32Array(lineCount * 2);

    return (
        <lineSegments>
            <bufferGeometry ref={geomRef}>
                <bufferAttribute attach="attributes-position" count={lineCount * 2} array={initialPositions} itemSize={3} />
                <bufferAttribute attach="attributes-opacity" count={lineCount * 2} array={initialOpacities} itemSize={1} />
            </bufferGeometry>
            <shaderMaterial
                transparent
                depthWrite={false}
                vertexShader={`
                    attribute float opacity;
                    varying float vOpacity;
                    void main() {
                        vOpacity = opacity;
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    }
                `}
                fragmentShader={`
                    varying float vOpacity;
                    void main() {
                        gl_FragColor = vec4(0.0, 0.4, 0.8, vOpacity * 0.7);
                    }
                `}
            />
        </lineSegments>
    );
}

function TransformerLayers() {
  const groupRef = useRef<THREE.Group>(null!);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (groupRef.current) {
      groupRef.current.rotation.x = -0.1 + Math.sin(t * 0.1) * 0.02;
      groupRef.current.rotation.y = -0.2 + Math.cos(t * 0.07) * 0.05;
      groupRef.current.rotation.z = Math.sin(t * 0.05) * 0.02;
    }
  });

  return (
    <group ref={groupRef}>
      {Array.from({ length: LAYER_COUNT }).map((_, i) => (
        <group key={i} position={[0, (i - (LAYER_COUNT - 1) / 2) * LAYER_SEPARATION, 0]}>
          <group rotation={[-Math.PI / 2, 0, 0]}>
            <LayerPlane />
            <NeuronGrid />
          </group>
        </group>
      ))}
      <DynamicConnections />
    </group>
  );
}

function SceneSetup() {
  const { camera } = useThree();
  
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const radius = 35;
    const speed = 0.05;

    const targetX = radius * Math.sin(t * speed);
    const targetY = 10 + Math.sin(t * speed * 1.5) * 3; 
    const targetZ = radius * Math.cos(t * speed);
    
    const targetPosition = new THREE.Vector3(targetX, targetY, targetZ);
    camera.position.lerp(targetPosition, 0.02);
    camera.lookAt(0, 0, 0);
  });

  return null;
}

export function NeuralNetworkVisual() {
  return (
    <Canvas dpr={[1, 1.5]}>
      <color attach="background" args={['#ffffff']} />
      <ambientLight intensity={0.8} />
      <directionalLight position={[0, 10, 10]} intensity={0.5} />
      <TransformerLayers />
      <SceneSetup />
    </Canvas>
  );
}

