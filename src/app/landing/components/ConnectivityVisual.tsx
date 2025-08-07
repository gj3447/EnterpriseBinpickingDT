"use client";

import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Delaunay } from "d3-delaunay";

function NodeParticles() {
    const { size, viewport } = useThree();
    const count = 100;

    const pointsRef = useRef<THREE.Points>(null!);
    const linesRef = useRef<THREE.LineSegments>(null!);
    
    const particles = useMemo(() => {
        const temp = [];
        for (let i = 0; i < count; i++) {
            const x = Math.random() * viewport.width - viewport.width / 2;
            const y = Math.random() * viewport.height - viewport.height / 2;
            const z = (Math.random() - 0.5) * 0.1;
            temp.push({
                position: new THREE.Vector3(x, y, z),
                velocity: new THREE.Vector3((Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.1, 0),
            });
        }
        return temp;
    }, [count, viewport.width, viewport.height]);

    useFrame(() => {
        const positions = pointsRef.current.geometry.attributes.position.array as Float32Array;
        const flatPositions: number[][] = [];

        particles.forEach((p, i) => {
            p.position.add(p.velocity);
            if (p.position.x < -viewport.width / 2 || p.position.x > viewport.width / 2) p.velocity.x *= -1;
            if (p.position.y < -viewport.height / 2 || p.position.y > viewport.height / 2) p.velocity.y *= -1;
            
            positions[i * 3] = p.position.x;
            positions[i * 3 + 1] = p.position.y;
            positions[i * 3 + 2] = p.position.z;
            flatPositions.push([p.position.x, p.position.y]);
        });
        
        // Delaunay triangulation
        const delaunay = Delaunay.from(flatPositions);
        const mesh = delaunay.render(); // This gives us an SVG path string, not ideal. We need the indices.
        const linePositions = linesRef.current.geometry.attributes.position.array as Float32Array;
        let lineIdx = 0;
        
        for (let i = 0; i < delaunay.triangles.length; i+=3) {
            const p1Index = delaunay.triangles[i];
            const p2Index = delaunay.triangles[i+1];
            const p3Index = delaunay.triangles[i+2];

            const p1 = particles[p1Index].position;
            const p2 = particles[p2Index].position;
            const p3 = particles[p3Index].position;

            // p1 -> p2
            linePositions[lineIdx++] = p1.x; linePositions[lineIdx++] = p1.y; linePositions[lineIdx++] = p1.z;
            linePositions[lineIdx++] = p2.x; linePositions[lineIdx++] = p2.y; linePositions[lineIdx++] = p2.z;
            // p2 -> p3
            linePositions[lineIdx++] = p2.x; linePositions[lineIdx++] = p2.y; linePositions[lineIdx++] = p2.z;
            linePositions[lineIdx++] = p3.x; linePositions[lineIdx++] = p3.y; linePositions[lineIdx++] = p3.z;
            // p3 -> p1
            linePositions[lineIdx++] = p3.x; linePositions[lineIdx++] = p3.y; linePositions[lineIdx++] = p3.z;
            linePositions[lineIdx++] = p1.x; linePositions[lineIdx++] = p1.y; linePositions[lineIdx++] = p1.z;
        }


        pointsRef.current.geometry.attributes.position.needsUpdate = true;
        linesRef.current.geometry.attributes.position.needsUpdate = true;
        (linesRef.current.geometry as THREE.BufferGeometry).setDrawRange(0, lineIdx / 3);
    });

    return (
        <>
            <points ref={pointsRef}>
                <bufferGeometry>
                    <bufferAttribute attach="attributes-position" count={count} array={new Float32Array(count * 3)} itemSize={3} />
                </bufferGeometry>
                <pointsMaterial size={4} color="#333333" sizeAttenuation={false} />
            </points>
            <lineSegments ref={linesRef}>
                <bufferGeometry>
                     <bufferAttribute attach="attributes-position" count={count * 3 * 2} array={new Float32Array(count * 3 * 2 * 3)} itemSize={3} />
                </bufferGeometry>
                <lineBasicMaterial color="#999999" />
            </lineSegments>
        </>
    );
}

export function ConnectivityVisual() {
    return (
        <Canvas camera={{ position: [0, 0, 10] }} dpr={[1, 1.5]}>
            <color attach="background" args={["#ffffff"]} />
            <NodeParticles />
        </Canvas>
    );
}

