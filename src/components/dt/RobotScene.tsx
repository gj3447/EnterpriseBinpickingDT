'use client';

// src/components/dt/RobotScene.tsx
import * as THREE from 'three';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Html } from '@react-three/drei';
import { URDFRobot } from 'urdf-loader';
import { SkeletonUtils, OBJLoader, MTLLoader } from 'three-stdlib';
import { WebsocketData, TransformData } from './types';
import { useInferenceStore } from '@/stores/inferenceStore';
import type { InferenceResult } from '@/stores/inferenceStore';
import { IK_OFFSET_LIMIT_X, IK_OFFSET_LIMIT_Z, IK_OFFSET_Y_MIN, IK_OFFSET_Y_MAX, getJointLimitsRad, useRobotControlStore } from '@/stores/robotControlStore';
import { useTransformStore } from '@/stores/transformStore';

interface RobotSceneProps {
    basePosition?: [number, number, number];
    transformData: WebsocketData;
    robotModel: URDFRobot;
    manualEnabled?: boolean;
    manualJointAnglesRad?: number[];
}

interface InferenceObjectProps {
    inference: InferenceResult;
    cameraPose: TransformData;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

function InferenceObject({ inference, cameraPose }: InferenceObjectProps) {
    const [mesh, setMesh] = useState<THREE.Group | null>(null);

    useEffect(() => {
        let cancelled = false;
        const loader = new OBJLoader();

        const loadObj = (materials?: MTLLoader.MaterialCreator) => {
            if (materials) {
                materials.preload();
                loader.setMaterials(materials);
            }

            loader.load(
                inference.meshPath,
                (object) => {
                    if (cancelled) {
                        return;
                    }

                    object.traverse((child) => {
                        const meshChild = child as THREE.Mesh;
                        if (meshChild.isMesh) {
                            meshChild.castShadow = true;
                            meshChild.receiveShadow = true;
                        }
                    });

                    setMesh(object);
                },
                undefined,
                (error) => {
                    console.error('OBJ 로드 실패', error);
                    if (!cancelled) {
                        setMesh(null);
                    }
                }
            );
        };

        const mtlPath = inference.meshPath.replace(/\.obj$/i, '.mtl');
        if (mtlPath !== inference.meshPath) {
            const mtlLoader = new MTLLoader();
            mtlLoader.load(
                mtlPath,
                (materials) => {
                    if (cancelled) {
                        return;
                    }
                    loadObj(materials);
                },
                undefined,
                () => {
                    if (!cancelled) {
                        loadObj();
                    }
                }
            );
        } else {
            loadObj();
        }

        return () => {
            cancelled = true;
        };
    }, [inference.meshPath, inference.timestamp]);

    const { position, quaternion } = useMemo(() => {
        const objectPositionCamera = new THREE.Vector3().fromArray(inference.pose.position);
        const objectQuaternionCamera = new THREE.Quaternion().fromArray(inference.pose.quaternion);

        const cameraPositionWorld = new THREE.Vector3().fromArray(cameraPose.translation);
        const cameraQuaternionWorld = new THREE.Quaternion().fromArray(cameraPose.orientation_quaternion);

        const worldPosition = objectPositionCamera
            .clone()
            .applyQuaternion(cameraQuaternionWorld)
            .add(cameraPositionWorld);

        const worldQuaternion = cameraQuaternionWorld.clone().multiply(objectQuaternionCamera);

        return {
            position: worldPosition,
            quaternion: worldQuaternion,
        };
    }, [inference.pose.position, inference.pose.quaternion, cameraPose.translation, cameraPose.orientation_quaternion]);

    if (!mesh) {
        return null;
    }

    return (
        <group position={position} quaternion={quaternion}>
            <primitive object={mesh} scale={0.001} />
            <Html position={[0, 0, 0.15]} className="pointer-events-none">
                <div className="px-2 py-1 text-xs font-semibold text-white bg-black/70 rounded border border-white/20">
                    {inference.objectName} ({inference.score.toFixed(4)})
                </div>
            </Html>
        </group>
    );
}

export function RobotScene({ basePosition = [0, 0, 0], transformData, robotModel, manualEnabled = false, manualJointAnglesRad }: RobotSceneProps) {
    const { robot: robotPose, camera: cameraPose, board: boardPose, external_markers } = transformData;

    const robot = useMemo<URDFRobot>(() => SkeletonUtils.clone(robotModel) as URDFRobot, [robotModel]);
    const jointNames = useMemo(
        () => ['joint_1', 'joint_2', 'joint_3', 'joint_4', 'joint_5', 'joint_6'],
        []
    );
    const gripperEnabled = useRobotControlStore((state) => state.gripperEnabled);
    const gripperLengthMm = useRobotControlStore((state) => state.gripperLengthMm);
    const ikEnabled = useRobotControlStore((state) => state.ikEnabled);
    const ikOffsetX = useRobotControlStore((state) => state.ikOffsetX);
    const ikOffsetY = useRobotControlStore((state) => state.ikOffsetY);
    const ikOffsetZ = useRobotControlStore((state) => state.ikOffsetZ);
    const ikEulerRollDeg = useRobotControlStore((state) => state.ikEulerRollDeg);
    const ikEulerPitchDeg = useRobotControlStore((state) => state.ikEulerPitchDeg);
    const ikEulerYawDeg = useRobotControlStore((state) => state.ikEulerYawDeg);
    const ikWorldPosition = useRobotControlStore((state) => state.ikWorldPosition);
    const gripperRef = useRef<THREE.Object3D | null>(null);
    const ikTargetRef = useRef<THREE.Object3D | null>(null);
    const boardGroupRef = useRef<THREE.Group | null>(null);

    const setIkWorldPosition = useRobotControlStore((state) => state.setIkWorldPosition);

    useEffect(() => {
        if (!manualEnabled) {
            return;
        }

        const targetAngles = manualJointAnglesRad ?? [];

        jointNames.forEach((jointName, index) => {
            const joint = robot.joints?.[jointName];
            if (joint && typeof joint.setJointValue === 'function') {
                const limit = getJointLimitsRad(index);
                const requestedAngle = targetAngles[index] ?? 0;
                const clampedAngle = clamp(requestedAngle, limit.min, limit.max);
                try {
                    joint.setJointValue(clampedAngle);
                } catch (error) {
                    console.error(`조인트 ${jointName} 값을 설정하지 못했습니다.`, error);
                }
            }
        });
    }, [manualEnabled, manualJointAnglesRad, jointNames, robot]);

    useEffect(() => {
        const disposeObject = (object: THREE.Object3D | null) => {
            if (!object) {
                return;
            }
            object.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    child.geometry?.dispose?.();
                    if (Array.isArray(child.material)) {
                        child.material.forEach((mat) => {
                            if ('map' in mat && mat.map) {
                                mat.map.dispose?.();
                            }
                            mat.dispose?.();
                        });
                    } else {
                        const mat = child.material as THREE.Material & { map?: THREE.Texture };
                        if (mat?.map) {
                            mat.map.dispose?.();
                        }
                        mat?.dispose?.();
                    }
                }
                if (child instanceof THREE.Sprite) {
                    if (child.material.map) {
                        child.material.map.dispose();
                    }
                    child.material.dispose();
                }
            });
        };

        const cleanup = () => {
            if (gripperRef.current && gripperRef.current.parent) {
                gripperRef.current.parent.remove(gripperRef.current);
            }
            disposeObject(gripperRef.current);
            gripperRef.current = null;
        };

        if (!robot || !boardGroupRef.current) {
            cleanup();
            return;
        }

        const endEffector = robot.links?.link_6 as THREE.Object3D | undefined;
        if (!endEffector) {
            cleanup();
            return () => cleanup();
        }

        cleanup();

        if (!gripperEnabled) {
            return () => cleanup();
        }

        const lengthMeters = Math.max(0, (gripperLengthMm ?? 0) / 1000);
        if (lengthMeters <= 0) {
            return () => cleanup();
        }

        endEffector.updateWorldMatrix(true, true);

        const baseWorldPosition = new THREE.Vector3();
        robot.updateWorldMatrix(true, true);
        robot.getWorldPosition(baseWorldPosition);

        const effectorWorldPosition = new THREE.Vector3();
        endEffector.getWorldPosition(effectorWorldPosition);

        const toEnd = effectorWorldPosition.clone().sub(baseWorldPosition);
        const toEndDir = toEnd.lengthSq() > 0 ? toEnd.clone().normalize() : new THREE.Vector3(0, 0, 1);

        const normalMatrix = new THREE.Matrix3().getNormalMatrix(endEffector.matrixWorld);

        const worldBox = new THREE.Box3().setFromObject(endEffector);
        const cornersWorld = [
            new THREE.Vector3(worldBox.min.x, worldBox.min.y, worldBox.min.z),
            new THREE.Vector3(worldBox.min.x, worldBox.min.y, worldBox.max.z),
            new THREE.Vector3(worldBox.min.x, worldBox.max.y, worldBox.min.z),
            new THREE.Vector3(worldBox.min.x, worldBox.max.y, worldBox.max.z),
            new THREE.Vector3(worldBox.max.x, worldBox.min.y, worldBox.min.z),
            new THREE.Vector3(worldBox.max.x, worldBox.min.y, worldBox.max.z),
            new THREE.Vector3(worldBox.max.x, worldBox.max.y, worldBox.min.z),
            new THREE.Vector3(worldBox.max.x, worldBox.max.y, worldBox.max.z),
        ];

        const cornersLocal = cornersWorld.map((corner) => endEffector.worldToLocal(corner.clone()));

        const axisBasis: Array<'x' | 'y' | 'z'> = ['x', 'y', 'z'];

        const axisResults = axisBasis.map((axis) => {
            const axisVector = new THREE.Vector3(
                axis === 'x' ? 1 : 0,
                axis === 'y' ? 1 : 0,
                axis === 'z' ? 1 : 0
            ).applyMatrix3(normalMatrix).normalize();

            const dot = axisVector.dot(toEndDir);
            const sign: 1 | -1 = dot >= 0 ? 1 : -1;
            const values = cornersLocal.map((corner) => corner[axis]);
            const tip = sign === 1 ? Math.max(...values) : Math.min(...values);

            return {
                axis,
                sign,
                tip,
                alignment: Math.abs(dot),
            };
        });

        axisResults.sort((a, b) => b.alignment - a.alignment);
        const chosen = axisResults[0] ?? { axis: 'z', sign: -1, tip: 0, alignment: 1 };

        const group = new THREE.Group();
        const crossSectionShort = 0.02;
        const crossSectionLong = crossSectionShort * 2;

        let geometry: THREE.BoxGeometry;
        if (chosen.axis === 'x') {
            geometry = new THREE.BoxGeometry(lengthMeters, crossSectionShort, crossSectionLong);
        } else if (chosen.axis === 'y') {
            geometry = new THREE.BoxGeometry(crossSectionLong, lengthMeters, crossSectionShort);
        } else {
            geometry = new THREE.BoxGeometry(crossSectionShort, crossSectionLong, lengthMeters);
        }

        const material = new THREE.MeshStandardMaterial({
            color: '#111111',
            transparent: false,
            opacity: 1,
            metalness: 0.2,
            roughness: 0.7,
        });

        const gripperMesh = new THREE.Mesh(geometry, material);
        gripperMesh.castShadow = true;
        gripperMesh.receiveShadow = true;
        group.add(gripperMesh);

        const tipOffset = chosen.tip;
        const centerOffset = chosen.sign * (lengthMeters / 2 + 0.0005);
        group.position[chosen.axis] = tipOffset + centerOffset;

        const endpointMarkerGeometry = new THREE.SphereGeometry(0.008, 24, 24);
        const endpointMarkerMaterial = new THREE.MeshStandardMaterial({ color: '#ef4444', emissive: '#7f1d1d' });
        const endpointMarker = new THREE.Mesh(endpointMarkerGeometry, endpointMarkerMaterial);
        endpointMarker.position[chosen.axis] = chosen.sign * (lengthMeters / 2 + 0.004);
        endpointMarker.position.y += 0.0;
        group.add(endpointMarker);

        endEffector.add(group);
        gripperRef.current = group;

        return () => cleanup();
    }, [robot, gripperEnabled, gripperLengthMm]);

    useEffect(() => {
        const removeIkTarget = () => {
            if (ikTargetRef.current && ikTargetRef.current.parent) {
                ikTargetRef.current.parent.remove(ikTargetRef.current);
            }
            if (ikTargetRef.current instanceof THREE.Object3D) {
                ikTargetRef.current.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        child.geometry?.dispose?.();
                        if (Array.isArray(child.material)) {
                            child.material.forEach((mat) => mat.dispose?.());
                        } else {
                            child.material?.dispose?.();
                        }
                    }
                });
            }
            ikTargetRef.current = null;
        };

        const hasWorldPosition = Array.isArray(ikWorldPosition) && ikWorldPosition.length === 3;

        if (!robot || typeof robot === 'string') {
            removeIkTarget();
            return;
        }

        if (!ikEnabled) {
            removeIkTarget();
            setIkWorldPosition(null);
            return;
        }

        removeIkTarget();

        let targetWorld: THREE.Vector3 | null = null;

        if (hasWorldPosition) {
            targetWorld = new THREE.Vector3(
                ikWorldPosition[0] ?? 0,
                ikWorldPosition[1] ?? 0,
                ikWorldPosition[2] ?? 0
            );
        } else {
            const boardOrigin = new THREE.Vector3(
                boardPose.translation[1] ?? 0,
                -(boardPose.translation[0] ?? 0),
                boardPose.translation[2] ?? 0
            );

            const forwardOffset = clamp(ikOffsetX, -IK_OFFSET_LIMIT_X, IK_OFFSET_LIMIT_X);
            const lateralOffset = clamp(ikOffsetZ, -IK_OFFSET_LIMIT_Z, IK_OFFSET_LIMIT_Z);
            const verticalOffset = clamp(ikOffsetY, IK_OFFSET_Y_MIN, IK_OFFSET_Y_MAX);

            targetWorld = boardOrigin.clone().add(
                new THREE.Vector3(forwardOffset, lateralOffset, verticalOffset)
            );

            setIkWorldPosition([targetWorld.x, targetWorld.y, targetWorld.z]);
        }

        if (!targetWorld) {
            return;
        }

        const markerGroup = new THREE.Group();
        markerGroup.position.copy(targetWorld);

        const outerSphereGeometry = new THREE.SphereGeometry(0.03, 24, 24);
        const outerSphereMaterial = new THREE.MeshStandardMaterial({ color: '#ef4444', transparent: true, opacity: 0.35, emissive: '#7f1d1d' });
        const outerSphere = new THREE.Mesh(outerSphereGeometry, outerSphereMaterial);
        markerGroup.add(outerSphere);

        const innerSphereGeometry = new THREE.SphereGeometry(0.012, 24, 24);
        const innerSphereMaterial = new THREE.MeshStandardMaterial({ color: '#ff4d4f', emissive: '#7f1d1d' });
        const innerSphere = new THREE.Mesh(innerSphereGeometry, innerSphereMaterial);
        markerGroup.add(innerSphere);

        const euler = new THREE.Euler(
            THREE.MathUtils.degToRad(ikEulerRollDeg),
            THREE.MathUtils.degToRad(ikEulerPitchDeg),
            THREE.MathUtils.degToRad(ikEulerYawDeg),
            'XYZ'
        );
        markerGroup.setRotationFromEuler(euler);

        const axisHelper = new THREE.AxesHelper(0.08);
        markerGroup.add(axisHelper);

        (robot as THREE.Object3D).add(markerGroup);
        ikTargetRef.current = markerGroup;

        return () => removeIkTarget();
    }, [
        robot,
        ikEnabled,
        ikOffsetX,
        ikOffsetY,
        ikOffsetZ,
        ikEulerRollDeg,
        ikEulerPitchDeg,
        ikEulerYawDeg,
        boardPose.translation,
        boardPose.orientation_quaternion,
        ikWorldPosition,
        setIkWorldPosition,
    ]);

    const updateTransforms = useTransformStore((state) => state.updateFromWebsocket);

    useEffect(() => {
        if (transformData) {
            updateTransforms(transformData);
        }
    }, [transformData, updateTransforms]);

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

    const inferenceMap = useInferenceStore((state) => state.inferences);
    const inferenceList = useMemo(
        () => Object.values(inferenceMap).sort((a, b) => b.timestamp - a.timestamp),
        [inferenceMap]
    );

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
                    <group ref={boardGroupRef} position={boardPos} quaternion={boardQuat}>
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
                            <Box args={[0.1, 0.1, 0.01]} castShadow>
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

                {inferenceList.map((inference) => (
                    <InferenceObject
                        key={`${inference.objectName}-${inference.timestamp}`}
                        inference={inference}
                        cameraPose={cameraPose}
                    />
                ))}
            </group>
        </group>
    );
}
