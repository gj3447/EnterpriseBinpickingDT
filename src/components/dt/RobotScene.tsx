// src/components/dt/RobotScene.tsx
import * as THREE from 'three';
import { useMemo } from 'react';
import { Box, Html } from '@react-three/drei';
import { URDFRobot } from 'urdf-loader';
import { SkeletonUtils } from 'three-stdlib';
import { WebsocketData, TransformData } from './types';

interface RobotSceneProps {
    basePosition?: [number, number, number];
    transformData: WebsocketData;
    robotModel: URDFRobot;
}

export function RobotScene({ basePosition = [0, 0, 0], transformData, robotModel }: RobotSceneProps) {
    const { robot: robotPose, camera: cameraPose, board: boardPose, external_markers } = transformData;

    const robot = useMemo(() => SkeletonUtils.clone(robotModel), [robotModel]);

    // 웹소켓 Z-up 데이터를 변환 없이 그대로 사용
    const robotPos = useMemo(() => new THREE.Vector3().fromArray(robotPose.translation), [robotPose.translation]);
    const robotQuatRaw = useMemo(() => new THREE.Quaternion().fromArray(robotPose.orientation_quaternion), [robotPose.orientation_quaternion]);
    
    // Z축 기준 반시계 90도 회전 추가
    const z_rot_90 = useMemo(() => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2), []);
    const robotQuat = useMemo(() => robotQuatRaw.clone().multiply(z_rot_90), [robotQuatRaw, z_rot_90]);

    const cameraPos = useMemo(() => new THREE.Vector3().fromArray(cameraPose.translation), [cameraPose.translation]);
    const cameraQuat = useMemo(() => new THREE.Quaternion().fromArray(cameraPose.orientation_quaternion), [cameraPose.orientation_quaternion]);
    
    const boardPos = useMemo(() => new THREE.Vector3().fromArray(boardPose.translation), [boardPose.translation]);
    const boardQuat = useMemo(() => new THREE.Quaternion().fromArray(boardPose.orientation_quaternion), [boardPose.orientation_quaternion]);

    const basePositionVec = useMemo(() => new THREE.Vector3().fromArray(basePosition), [basePosition]);

    const checkerboardTexture = useMemo(() => {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) return new THREE.CanvasTexture(canvas);
        
        canvas.width = 8;
        canvas.height = 7;
        
        context.fillStyle = 'rgba(255, 255, 255, 0.5)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        context.fillStyle = 'rgba(128, 128, 128, 0.5)';
        for (let i = 0; i < canvas.width; i++) {
            for (let j = 0; j < canvas.height; j++) {
                if ((i + j) % 2 === 0) {
                    context.fillRect(i, j, 1, 1);
                }
            }
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.magFilter = THREE.NearestFilter;
        texture.needsUpdate = true;
        return texture;
    }, []);

    return (
        // MultiRobotViewer의 로봇 위치 오프셋
        <group position={basePositionVec}>
            {/* 이 그룹이 Z-up 세상을 Y-up 씬으로 변환하는 역할을 합니다. */}
            <group rotation={[-Math.PI / 2, 0, 0]}>
                
                {/* 로봇: Z-up 데이터 그대로 적용 */}
                <primitive
                    object={robot}
                    position={robotPos}
                    quaternion={robotQuat}
                    castShadow
                    receiveShadow
                />
                
                {/* 카메라: Z-up 데이터 그대로 적용 */}
                <group position={cameraPos} quaternion={cameraQuat}>
                    <Box args={[0.1, 0.1, 0.2]} castShadow>
                        <meshStandardMaterial color="skyblue" />
                    </Box>
                </group>

                {/* 보드: Z-up 데이터 그대로 적용. PlaneGeometry는 기본이 XY평면이므로 자동으로 바닥에 눕게 됩니다. */}
                {transformData.board_detected && (
                    <group position={boardPos} quaternion={boardQuat}>
                        <mesh castShadow>
                            <planeGeometry args={[0.8, 0.7]} />
                            <meshStandardMaterial 
                                map={checkerboardTexture}
                                transparent={true}
                                side={THREE.DoubleSide} 
                            />
                        </mesh>
                    </group>
                )}

                {/* 마커: Z-up 데이터 그대로 적용 */}
                {external_markers.map((marker) => {
                    const markerPos = new THREE.Vector3().fromArray(marker.pose.translation);
                    const markerQuat = new THREE.Quaternion().fromArray(marker.pose.orientation_quaternion);
                    return (
                        <group key={marker.id} position={markerPos} quaternion={markerQuat}>
                            <Box args={[0.1, 0.1, 0.1]} castShadow>
                                <meshStandardMaterial color="gray" />
                            </Box>
                            <Html position={[0, 0, 0.06]}>
                                <div className="text-white text-xs font-bold bg-black bg-opacity-50 px-1 rounded">
                                    {marker.id}
                                </div>
                            </Html>
                        </group>
                    );
                })}
            </group>
        </group>
    );
}
