# MARKER 명령어 확장 계획

시퀀스 인터프리터에 `MARKER=<ID>` 명령을 추가해, 지정한 ArUco 마커 위치로 자동 IK → 로봇 이동 → 정지 대기까지 수행하는 기능을 설계한다.

## 요구사항 정리

1. `MARKER=140` 처럼 쓰면, WebSocket으로 수신한 `external_markers` 목록에서 ID 140과 매칭되는 마커를 찾아야 한다.
2. 찾은 마커의 pose를 기반으로 IK 슬라이더/타깃을 설정하고 `performIkAutoSolve()`로 joint 각도/그리퍼 길이를 계산한다.
3. DT 상태 업데이트 후, `pushTargetJoints`로 OPC-UA에 명령을 전달해 실제 로봇이 해당 IK에 맞춰 움직이게 한다.
4. 명령 실행 후에는 `commandStatus !== 4`가 될 때까지 `waitForIdle()`로 폴링하여 로봇이 정지했음을 확인한 뒤 다음 명령으로 넘어간다.
5. 마커가 없거나 IK 실패 시에는 에러 대신 “건너뜀” 메시지를 남기고 다음 명령으로 진행한다.

## 설계

### 1. 마커 조회

- `useTransformStore`에 `getMarkerById(id: number)` selector를 추가하거나, 시퀀스 패널에서 `useTransformStore.getState().external_markers`를 직접 참조한다.
- 마커 pose는 ROS frame 기준 좌표로 들어오므로, 기존 `RobotMarkerPanel`과 동일한 축 변환 로직을 재사용한다.

### 2. IK 타깃 세팅 및 Auto Solve

- `RobotMarkerPanel`에서 사용하는 흐름:
  1. 보드 origin을 기준으로 마커 position을 변환 (`Vector3` → `setIkOffsetX/Y/Z` 및 `setIkWorldPosition`).
  2. `performIkAutoSolve()` 호출 → jointAnglesDeg, gripperLength, manualEnabled 업데이트.
- 시퀀스에서도 이 함수들을 그대로 호출해 동일한 결과를 얻는다.

### 3. 로봇 이동 및 대기

- IK 결과를 DT에 반영한 직후 `pushTargetJoints`를 호출해 OPC-UA 명령 전송.
- 기존 `POSE` 명령처럼 `waitForIdle('명령 실행')`을 호출해 commandStatus가 4가 아닌 값(완료/대기)이 될 때까지 대기한다.

### 4. 예외 처리

- 마커가 없다면 “Marker #ID not found. Skip.” 메시지를 표시하고 다음 명령으로 넘어간다.
- `performIkAutoSolve()`나 `pushTargetJoints`에서 오류가 발생하면 메시지를 남기되, 시퀀스 전체는 계속 진행한다.
- IK 결과 jointAnglesDeg가 비어 있으면 “IK result missing joints”로 간주하고 skip.

## 구현 단계

1. `useTransformStore`에 marker 조회 helper 추가 (예: `getMarkerById`).
2. `RobotSequencePanel`에 `executeMarkerCommand(id: string)` helper 추가:
   - 숫자로 파싱 → 마커 조회 → IK 타깃 세팅 → `performIkAutoSolve()` → `pushTargetJoints`.
3. 기존 시퀀스 파서에 `else if (command === 'MARKER')` 구문 추가:
   - payload → `executeMarkerCommand`.
   - 성공 시 `requiresRobotIdle = true`, 실패 시 skip 메시지 출력.
4. 테스트: `MARKER=140; GRIP; MARKER=200; RELEASE;` 시나리오로 로봇 이동/그리퍼 동작이 순환되는지 확인.

## 후속 아이디어

- `MARKER=140@offset` 처럼 오프셋을 추가하거나,
- `WAIT=1000` 명령으로 강제 지연을 넣는 등, 명령어를 점진적으로 확장할 수 있다.


