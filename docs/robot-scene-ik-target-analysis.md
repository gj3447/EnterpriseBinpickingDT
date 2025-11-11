## RobotScene IK 타깃 좌표계 분석

### 개요
- `RobotScene`의 IK 타깃 생성 `useEffect`는 보드 좌표와 슬라이더 오프셋을 Three.js 씬 좌표로 변환해 시각화합니다.
- 최근 `RobotMarkerPanel`에서 ROS → 실제 좌표 보정을 적용했지만, `RobotScene`은 이전 좌표계 가정을 그대로 사용하고 있어 IK 타깃이 마커 위치와 어긋납니다.

### 현행 로직 요약
- 보드 그룹(`boardGroupRef`)의 월드 행렬을 기준으로 타깃 위치를 계산합니다.
- `desiredOrigin`에서 ROS `translation`의 X/Y를 서로 바꾸고 Y에 음수 부호를 적용한 뒤 Z를 0으로 고정합니다.
- 슬라이더 오프셋을 `clampedDepth → X`, `-clampedHeight → Y`, `clampedWidth → Z`로 재배치해 로컬 좌표를 만들고, `localToWorld` 결과에 `originShift`를 더합니다.
- 최종 월드 좌표를 `setIkWorldPosition`으로 다시 저장해 스토어 값을 덮어씁니다.

```384:399:src/components/dt/RobotScene.tsx
const desiredOrigin = new THREE.Vector3(
  boardPose.translation[1] ?? 0,
  -(boardPose.translation[0] ?? 0),
  0
);
const currentOrigin = boardGroup.localToWorld(new THREE.Vector3(0, 0, 0));
const originShift = desiredOrigin.sub(currentOrigin);

const ikTargetLocal = new THREE.Vector3(clampedDepth, -clampedHeight, clampedWidth);
const ikTargetPosition = boardGroup
  .localToWorld(ikTargetLocal.clone())
  .add(originShift);
setIkWorldPosition([ikTargetPosition.x, ikTargetPosition.y, ikTargetPosition.z]);
```

### 문제점
1. **좌표 축 재정의가 과도함**: `desiredOrigin` 계산에서 X/Y 교환 및 부호 반전, Z 고정을 수행해 ROS 좌표계를 변형합니다. 패널 측에서 이미 ROS 좌표를 실제 축에 맞게 보정했으므로 이 추가 변환이 오히려 오차를 유발합니다.
2. **슬라이더→로컬 변환 불일치**: `ikTargetLocal`에서 width/depth/height를 X/Z/Y에 강제로 매핑한 결과, 마커와 같은 지점으로 이동해야 할 IK 타깃이 다른 축으로 이동합니다.
3. **ROS 좌표 덮어쓰기**: 마커 선택 시 스토어에 저장된 ROS 월드 좌표가 `RobotScene` 실행 때마다 씬 좌표로 덮어써져 패널 표시와 뷰어가 서로 다른 좌표계를 바라보게 됩니다.

### 영향
- 마커를 선택해도 IK 타깃이 동일 위치로 이동하지 않고, 슬라이더 조작 시 표시되는 좌표와 실제 씬 상 위치가 불일치합니다.
- `setIkWorldPosition`이 씬 좌표를 주입하면서 이후 패널/IK 패널 로직도 Scene(Y-up) 기반 숫자를 사용하게 됩니다.

### 개선 제안
1. **ROS 좌표 유지**: `desiredOrigin`를 ROS `translation` 그대로 사용하고, 필요하면 일관된 회전 변환(예: `rosToSceneQuaternion`)만 적용합니다.
2. **축 매핑 재정비**: 슬라이더 오프셋 → 로컬 좌표 변환을 패널/ROS와 동일한 축 정의로 통일합니다.
3. **덮어쓰기 방지**: 외부에서 월드 좌표가 설정된 경우(`ikWorldPosition` 존재)에는 `RobotScene`이 다시 저장하지 않거나, 저장하기 전에 ROS 좌표계로 재변환합니다.
4. **테스트 케이스**: 마커 좌표, 슬라이더 오프셋, IK 타깃 오브젝트의 월드 좌표가 모두 일치하는지 디버그 출력을 추가해 확인합니다.

### 다음 단계 체크리스트
- [ ] `desiredOrigin`을 ROS 좌표 기준으로 재구현
- [ ] `ikTargetLocal` 축 매핑 교정
- [ ] `setIkWorldPosition` 덮어쓰기 가드 추가
- [ ] 마커 선택 → IK 타깃 일치 여부 실측

### `ikWorldPosition` 덮어쓰기 상세 분석

- **클린업 시점 초기화**: 이 `useEffect`는 실행할 때마다 먼저 `cleanup()`을 호출하며, 이때 `setIkWorldPosition(null)`을 수행합니다. 결과적으로 패널이 ROS 좌표를 기록하자마자 곧바로 `null`로 초기화됩니다.
- **씬 좌표 재기록**: 이후 새로운 타깃 그룹을 만들면서 `markerGroup.position`(Three 씬 좌표)을 복사해 다시 `setIkWorldPosition([...])`으로 저장합니다. 외부에서 ROS 좌표를 주입했더라도 씬 좌표가 덮어쓰면서 패널/IK 패널이 Scene(Y-up) 기준 값으로 바뀝니다.
- **결과적 영향**: 마커 선택 직후엔 ROS 좌표가 표시되지만, 다음 렌더/슬라이더 변화 시 씬 좌표가 주입되어 패널과 뷰어가 서로 다른 좌표계를 참조합니다. IK 요청 시에도 변형된 좌표가 사용돼 실제 마커 위치와 어긋납니다.

#### 개선 방향
1. **조건부 업데이트**: 이미 `ikWorldPosition`이 설정되어 있다면 `setIkWorldPosition(null)` 및 재설정을 건너뛰거나, 실제로 Scene 좌표가 필요한 경우 별도 상태로 관리합니다.
2. **좌표 변환 통일**: 씬에서 계산한 위치를 저장해야 한다면, 저장 전에 ROS 좌표계로 역변환해 스토어에는 항상 ROS 기준 값만 남도록 합니다.
3. **UI/3D 분리**: UI 패널에서 사용하는 좌표는 독립된 상태(예: `ikWorldPositionRos`)로 유지하고, 뷰어는 자체적으로 Scene 좌표만 관리하면 상태 충돌을 피할 수 있습니다.


