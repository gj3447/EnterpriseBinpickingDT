# GatewayServer V3 구조 요약

## 아키텍처 개요

- `GatewayServerv3.py`  
  - `GatewayServerV3` 클래스를 선언하고 실행 엔트리포인트(`main()`)를 제공한다.  
  - `OpcServerMixin`, `ModbusTaskMixin`, `SubscriptionMixin`을 조합해 OPC/Modbus 기능을 구성한다.  
  - `LimitLoader`를 통해 `a0509_*` CSV에서 각종 안전 제한을 불러와 초기화한다.
- `v3/gateway.py`  
  - OPC 노드 생성/구독, Modbus 상태 관리 로직을 mixin 형태로 제공한다.
- `v3/limits.py`  
  - 조인트 각도/속도, TCP 제한 CSV를 읽어 사전에 변환한다.

## 제한값 로딩

| CSV 파일 | 설명 |
| --- | --- |
| `a0509_joint_angle_limits_full.csv` | 각 조인트의 명령 가능 범위를 정의. |
| `a0509_joint_velocity_limits_full.csv` | 조인트 속도 상한 정의. |
| `a0509_tcp_limits.csv` | 힘/동력/속도 등의 TCP 제한 정의. |

`GatewayServerV3`는 기동 시 이 값들을 우선 적용하고, 실패 시 `robot_config.json` 값을 사용한다.

## OPC 서버 트리 (태그/타입)

```
MyRobot
 ├─ Status
 │   ├─ CurrentJoints            (Double[6])
 │   ├─ CurrentTCP               (Double[6])
 │   ├─ JointTorques             (Double[6])
 │   ├─ ToolForces               (Double[6])
 │   ├─ MotionState              (Int32)
 │   ├─ CommandStatus            (Int32)
 │   ├─ ErrorCode                (Int32)
 │   ├─ Gripper
 │   │   ├─ Status
 │   │   │   ├─ In1 / In2 / In3          (Boolean)
 │   │   │   ├─ InternalState            (Boolean)
 │   │   │   └─ SyncState                (Boolean)
 │   │   └─ Commands
 │   │       ├─ Open                     (Boolean)
 │   │       └─ Close                    (Boolean)
 │   └─ Custom
 │       ├─ CurrentJoint0~5     (Double)
 │       ├─ CurrentTcp0~5       (Double)
 │       ├─ CurrentTorque0~5    (Double)
 │       └─ CurrentToolForce0~5 (Double)
 ├─ Commands
 │   ├─ TargetJoints            (Double[6])
 │   ├─ TargetTCP               (Double[6])
 │   ├─ Mode                    (Int32)
 │   ├─ JVel / JAcc             (Double)
 │   ├─ LVel / LAcc             (Double)
 │   └─ Trigger                 (Int32)
 └─ ModbusConnection
     ├─ Connected               (Boolean)
     ├─ LastDisconnectTime      (String)
     ├─ LastReconnectTime       (String)
     ├─ ReconnectElapsed        (Int32)
     ├─ ReconnectAttempts       (Int32)
     └─ TotalDisconnected       (Int32)
```

### Commands/Gripper Numeric NodeId (2025-11-21 스냅샷)

`/api/opcua/tree` 엔드포인트를 `startNodeId="ns=2;i=3"`으로 호출한 결과, Commands/Gripper 관련 노드는 다음과 같은 Numeric NodeId로 생성되어 있다. (기존 문서의 50~57 → 현재 52~59로 **+2** 경사)

| Browse Name | NodeId |
| --- | --- |
| TargetJoints | `ns=2;i=52` |
| TargetTCP | `ns=2;i=53` |
| Mode | `ns=2;i=54` |
| JVel | `ns=2;i=55` |
| JAcc | `ns=2;i=56` |
| LVel | `ns=2;i=57` |
| LAcc | `ns=2;i=58` |
| Trigger | `ns=2;i=59` |
| Gripper.Commands.Open | `ns=2;i=60` |
| Gripper.Commands.Close | `ns=2;i=61` |

### NodeId 재확인 절차 (PowerShell)

```powershell
$body = @{
  startNodeId        = "ns=2;i=3"
  maxDepth           = 2
  maxChildrenPerNode = 50
} | ConvertTo-Json

Invoke-WebRequest `
  -Uri "http://localhost:53001/api/opcua/tree" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body `
  -OutFile ".\v3opcserver_commands_tree.json"
```

생성된 JSON에서 `dataType`/`nodeId`를 확인해 문서와 클라이언트 상수를 최신 상태로 유지한다.

## OPC UA 클라이언트 타입 가이드

서버는 위 노드 정의대로 VariantType을 엄격히 검증한다. 다른 타입을 쓰면 `BadTypeMismatch` 혹은 `Write refused` 오류가 발생하므로 아래 사양에 맞춰 값을 전송해야 한다.

| 구분 | 노드 | 요구 타입 | 비고 |
| --- | --- | --- | --- |
| 상태(Double 배열) | `CurrentJoints`, `CurrentTCP`, `JointTorques`, `ToolForces` | `Double[6]` | 각 요소는 64-bit 부동소수. |
| 상태(Double) | `CurrentJoint0~5`, `CurrentTcp0~5`, `CurrentTorque0~5`, `CurrentToolForce0~5` | `Double` | 개별 채널. |
| 상태(Int32) | `MotionState`, `CommandStatus`, `ErrorCode` | `Int32` | 32-bit 정수 범위. |
| 명령(Double 배열) | `TargetJoints`, `TargetTCP` | `Double[6]` | 명령 좌표. |
| 명령(Double) | `JVel`, `JAcc`, `LVel`, `LAcc` | `Double` | 속도/가속도. |
| 명령(Int32) | `Mode`, `Trigger` | `Int32` | 1=movej, 2=movel. |
| 연결(Int32) | `ReconnectElapsed`, `ReconnectAttempts`, `TotalDisconnected` | `Int32` | 카운터/시간(ms) |
| 연결(Boolean/String) | `Connected`(Bool), `LastDisconnectTime`(String), `LastReconnectTime`(String) | | ISO8601 문자열 사용. |
| 그리퍼(Boolean) | `Gripper.Status.In1/2/3`, `InternalState`, `SyncState`, `Gripper.Commands.Open/Close` | `Boolean` | True/False |

### 쓰기 시 참고 사항

- `Trigger`는 **Int32**로 `1` 이상을 쓰면 즉시 동작하고, 서버가 자동으로 0으로 되돌려 준다.
- `Mode`는 movej=1, movel=2. 다른 값은 무시된다.
- Double 배열 노드를 쓸 때는 반드시 길이 6 리스트와 Double Variant 타입을 사용한다.
- Int32 노드에 Double(예: 50.0)이나 Int64를 쓰면 거부된다. 항상 32-bit 정수 Variant로 전송해야 한다.
- Boolean 노드는 True/False만 허용한다. 0/1 정수는 Boolean Variant로 캐스팅해서 써야 한다.

### 타입 미스매치 디버깅

- `GatewayServerV3`는 Variant 타입이 틀리면 `BadTypeMismatch`를 반환하면서, 서버 로그에 `[TYPE_MISMATCH] nodeId=...` 형식으로 상세 정보를 남긴다.
- 로그에는 `nodeId`, `BrowseName`, 기대 타입(`expected`), 실제 타입(`got`), 실제 값(`value`)이 모두 포함된다. 예시:
  ```
  [TYPE_MISMATCH] nodeId=ns=2;i=53 browse=MyRobot.Commands.Mode expected=VariantType.Int32 got=VariantType.Double value=50.0
  ```
- 해당 로그를 사용하면 잘못된 Variant를 보낸 클라이언트를 즉시 파악할 수 있으며, 여러 클라이언트가 동시에 연결된 환경에서도 문제 노드를 빠르게 추적할 수 있다.

## Next.js 연동용 OPC 메타데이터

Next.js 앱에서 노드 구조를 그대로 UI에 렌더링하거나 폼을 생성할 수 있도록 핵심 노드를 아래 표처럼 정리했다. `Path`는 OPC UA 브라우저 상의 브라우즈 경로이며, TypeScript 모델은 다음 섹션 참고.

| 그룹 | 노드 | Path | VariantType | Writable | 설명 |
| --- | --- | --- | --- | --- | --- |
| Status | CurrentJoints | `["MyRobot","Status","CurrentJoints"]` | `Double[6]` | R | 현재 조인트 각도 (deg). |
| Status | CurrentTCP | `["MyRobot","Status","CurrentTCP"]` | `Double[6]` | R | TCP pose. |
| Status | MotionState | `["MyRobot","Status","MotionState"]` | `Int32` | R | 0=Idle, 1=Busy ... |
| Status | CommandStatus | `["MyRobot","Status","CommandStatus"]` | `Int32` | R | 최근 명령 상태코드. |
| Status | ErrorCode | `["MyRobot","Status","ErrorCode"]` | `Int32` | R | 컨트롤러 에러 코드. |
| Status | Gripper/In1~3 | `["MyRobot","Gripper","Status","InX"]` | `Boolean` | R | 실 센서 상태. |
| Commands | TargetJoints | `["MyRobot","Commands","TargetJoints"]` | `Double[6]` | RW | movej 목표각. |
| Commands | TargetTCP | `["MyRobot","Commands","TargetTCP"]` | `Double[6]` | RW | movel 목표. |
| Commands | Mode | `["MyRobot","Commands","Mode"]` | `Int32` | RW | 1=movej, 2=movel. |
| Commands | JVel/JAcc | `["MyRobot","Commands","JVel"]` etc. | `Double` | RW | 조인트 속도/가속도. |
| Commands | LVel/LAcc | `["MyRobot","Commands","LVel"]` etc. | `Double` | RW | 선형 속도/가속도. |
| Commands | Trigger | `["MyRobot","Commands","Trigger"]` | `Int32` | RW | 명령 실행 트리거. |
| Gripper | Open/Close | `["MyRobot","Gripper","Commands","Open"]` 등 | `Boolean` | RW | 그리퍼 제어. |
| Modbus | Connected | `["MyRobot","ModbusConnection","Connected"]` | `Boolean` | R | 연결 여부. |
| Modbus | ReconnectAttempts | `["MyRobot","ModbusConnection","ReconnectAttempts"]` | `Int32` | R | 재시도 횟수. |
| Modbus | LastDisconnectTime | `["MyRobot","ModbusConnection","LastDisconnectTime"]` | `String` | R | ISO8601 시각. |

### TypeScript 인터페이스 예시

```ts
export type VariantType = "Double" | "Double[6]" | "Int32" | "Boolean" | "String";

export interface OpcNodeMeta {
  path: string[];
  nodeId?: string;        // 필요 시 UA 노드ID를 직접 기록
  type: VariantType;
  writable: boolean;
  description: string;
}

export const opcNodes: Record<string, OpcNodeMeta> = {
  currentJoints: {
    path: ["MyRobot", "Status", "CurrentJoints"],
    type: "Double[6]",
    writable: false,
    description: "현재 조인트 각도",
  },
  targetJoints: {
    path: ["MyRobot", "Commands", "TargetJoints"],
    type: "Double[6]",
    writable: true,
    description: "movej 명령 목표",
  },
  trigger: {
    path: ["MyRobot", "Commands", "Trigger"],
    type: "Int32",
    writable: true,
    description: "명령 실행 플래그",
  },
  gripperOpen: {
    path: ["MyRobot", "Gripper", "Commands", "Open"],
    type: "Boolean",
    writable: true,
    description: "그리퍼 Open 출력",
  },
  modbusConnected: {
    path: ["MyRobot", "ModbusConnection", "Connected"],
    type: "Boolean",
    writable: false,
    description: "Modbus 연결 상태",
  },
};
```

이 메타데이터를 Next.js 프로젝트에서 import 하면, UI 컴포넌트가 자동으로 타입·읽기/쓰기 제약에 맞춰 폼을 생성할 수 있다. 예를 들어 `type === "Double[6]"`이면 6개의 숫자 필드를, `Boolean`이면 토글 스위치를 그리도록 매핑하면 된다.

또한 `path` 정보만으로 UA Session을 통해 노드를 찾기 어려운 경우 `nodeId` 필드를 추가해 실제 `ns=2;i=...` 같은 값으로 채우면 된다.
