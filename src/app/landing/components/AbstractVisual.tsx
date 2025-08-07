"use client";

import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";

function WavyPlane() {
  const ref = useRef<THREE.Mesh>(null!);
  const { viewport, mouse } = useThree();

  // PlaneGeometry의 버텍스 데이터를 담을 참조
  const geometryRef = useRef<THREE.PlaneGeometry>(null!);

  // 최초 위치와 랜덤값을 기억하기 위해 useMemo 사용
  const { originalPositions, randomValues } = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(15, 15, 60, 60);
    const count = geometry.attributes.position.count;
    const originalPositions = Float32Array.from(
      geometry.attributes.position.array
    );
    const randomValues = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      randomValues[i] = (Math.random() - 0.5) * 2; // -1 to 1
    }
    return { originalPositions, randomValues };
  }, []);

  useFrame((state) => {
    const { clock } = state;
    if (geometryRef.current) {
      const positions =
        geometryRef.current.attributes.position.array as Float32Array;

      // 마우스 위치를 화면 비율에 맞게 조정
      const mouseX = (mouse.x * viewport.width) / 2;
      const mouseY = (mouse.y * viewport.height) / 2;
      
      for (let i = 0; i < positions.length; i += 3) {
        const x = originalPositions[i];
        const y = originalPositions[i + 1];
        const i_flat = i / 3;
        
        const time = clock.getElapsedTime();

        // 시간에 따라 자연스럽게 출렁이는 효과
        const baseWave =
          Math.sin(x * 0.4 + time) * 0.1 + Math.cos(y * 0.4 + time) * 0.1;

        // 마우스 주변에 상호작용 효과 추가
        const distanceToMouse = Math.sqrt(Math.pow(x - mouseX, 2) + Math.pow(y - mouseY, 2));
        const mouseEffect = Math.max(0, 1 - distanceToMouse / 4) * 0.5;

        // 최종 z 위치
        positions[i + 2] = baseWave + mouseEffect + randomValues[i_flat] * 0.05;
      }

      // 버텍스 데이터 업데이트 알림
      geometryRef.current.attributes.position.needsUpdate = true;
    }
  });

  return (
    <mesh ref={ref}>
      <planeGeometry args={[15, 15, 60, 60]} ref={geometryRef} />
      <meshStandardMaterial
        wireframe
        color="#999999"
        wireframeLinewidth={2}
      />
    </mesh>
  );
}

export function AbstractVisual() {
  return (
    <Canvas camera={{ position: [0, 0, 5] }}>
      <ambientLight intensity={1.0} />
      <WavyPlane />
    </Canvas>
  );
}

