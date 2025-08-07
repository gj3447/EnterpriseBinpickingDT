"use client";

import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";

// 3D Simplex Noise 함수 (외부 라이브러리 대신 간단히 구현)
// 이는 실제 심플렉스 노이즈는 아니지만, 유사한 유기적 노이즈를 생성합니다.
function createNoise3D() {
  const perm = Array.from({ length: 256 }, () => Math.floor(Math.random() * 256));
  const p = new Uint8Array(512);
  for(let i=0; i < 256; i++) p[i] = p[i + 256] = perm[i];

  function fade(t: number) { return t * t * t * (t * (t * 6 - 15) + 10); }
  function lerp(t: number, a: number, b: number) { return a + t * (b - a); }
  function grad(hash: number, x: number, y: number, z: number) {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  return function noise(x: number, y: number, z: number) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    z -= Math.floor(z);
    const u = fade(x);
    const v = fade(y);
    const w = fade(z);
    const A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z;
    const B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z;

    return lerp(w, lerp(v, lerp(u, grad(p[AA], x, y, z),
                                     grad(p[BA], x - 1, y, z)),
                             lerp(u, grad(p[AB], x, y - 1, z),
                                     grad(p[BB], x - 1, y - 1, z))),
                     lerp(v, lerp(u, grad(p[AA + 1], x, y, z - 1),
                                     grad(p[BA + 1], x - 1, y, z - 1)),
                             lerp(u, grad(p[AB + 1], x, y - 1, z - 1),
                                     grad(p[BB + 1], x - 1, y - 1, z - 1))));
  };
}


function Particles() {
    const count = 5000;
    const pointsRef = useRef<THREE.Points>(null!);
    const { viewport } = useThree();

    const noise = useMemo(() => createNoise3D(), []);

    const particles = useMemo(() => {
        const temp = [];
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const color = new THREE.Color();

        for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            positions[i3] = (Math.random() - 0.5) * 10;
            positions[i3 + 1] = (Math.random() - 0.5) * 10;
            positions[i3 + 2] = (Math.random() - 0.5) * 10;

            // 흰 배경에 잘 보이도록 채도를 높이고 명도를 낮춘 색상 사용
            color.setHSL(Math.random(), 0.9, 0.4);
            colors[i3] = color.r;
            colors[i3+1] = color.g;
            colors[i3+2] = color.b;
            
            temp.push({
                position: new THREE.Vector3(positions[i3], positions[i3+1], positions[i3+2]),
                velocity: new THREE.Vector3(),
            });
        }
        return { particles: temp, positions, colors };
    }, [count]);

    useFrame((state) => {
        const { clock } = state;
        const time = clock.getElapsedTime() * 0.2;
        const positions = pointsRef.current.geometry.attributes.position.array as Float32Array;

        particles.particles.forEach((particle, i) => {
            const i3 = i * 3;
            const pos = particle.position;

            const n = noise(pos.x * 0.1, pos.y * 0.1, pos.z * 0.1 + time);
            
            particle.velocity.set(n, n, n).multiplyScalar(0.1);
            pos.add(particle.velocity);

            // Wrap around screen boundaries
            if (pos.x > viewport.width / 2) pos.x = -viewport.width / 2;
            if (pos.x < -viewport.width / 2) pos.x = viewport.width / 2;
            if (pos.y > viewport.height / 2) pos.y = -viewport.height / 2;
            if (pos.y < -viewport.height / 2) pos.y = viewport.height / 2;

            positions[i3] = pos.x;
            positions[i3 + 1] = pos.y;
            positions[i3 + 2] = pos.z;
        });

        pointsRef.current.geometry.attributes.position.needsUpdate = true;
    });

    return (
        <points ref={pointsRef}>
            <bufferGeometry>
                <bufferAttribute
                    attach="attributes-position"
                    count={count}
                    array={particles.positions}
                    itemSize={3}
                />
                <bufferAttribute
                    attach="attributes-color"
                    count={count}
                    array={particles.colors}
                    itemSize={3}
                />
            </bufferGeometry>
            <pointsMaterial size={0.03} vertexColors />
        </points>
    );
}

export function QuantumVisual() {
    return (
        <Canvas camera={{ position: [0, 0, 5] }} dpr={[1, 2]}>
             <color attach="background" args={["#ffffff"]} />
            <Particles />
        </Canvas>
    );
}

