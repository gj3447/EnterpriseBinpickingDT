# Enterprise BinPicking DT

이 프로젝트는 엔터프라이즈 빈 피킹(Bin Picking) 로봇 시스템의 디지털 트윈(Digital Twin)을 위한 웹 애플리케이션입니다. 로봇의 상태, 경로 학습 과정, 실시간 카메라 피드 등 다양한 데이터를 시각화하고 모니터링하는 기능을 제공합니다.

## 주요 기능

- **제품 소개 페이지 (`/landing`):** 서비스의 핵심 기능과 가치를 소개하는 랜딩 페이지입니다.
- **로봇 DT 페이지 (`/robot-dt`):** 단일 로봇의 상태를 디지털 트윈으로 실시간 모니터링합니다.
- **로봇 경로 학습 페이지 (`/robot-path-learning`):** 여러 로봇의 경로 학습 과정을 동시에 시각화하여 보여줍니다.
- **실시간 이미지 뷰어 (`/image-viewer`):** 4개의 개별 웹소켓 스트림(Color, Depth, ArUco Debug, Board Perspective)을 통해 실시간 카메라 피드를 제공합니다. 특히 `Board Perspective` 뷰는 고유한 비율을 유지하며 강조 표시됩니다.
- **자세 관리 도크:** `Robot DT` 화면 좌측 팝업에서 로봇 관절 각도를 북마크로 저장/적용/삭제할 수 있습니다. 리스트는 토글 방식으로 열고 닫을 수 있으며, 자세별 관절 값은 `자세히` 버튼으로 확인할 수 있습니다.
- **IKPy 프록시 및 자동 재시도:** 프런트엔드가 `/api/robot/ik/ikpy`·`/api/robot/ik/ikpy/downward` 로 요청을 전송하며, 백엔드가 404를 반환하면 기존 엔드포인트(`/api/robot/ik`, `/api/robot/ik/downward`)로 자동 재시도합니다.
- **그리퍼 길이 관리:** 기본 그리퍼 길이는 240 mm로 설정되어 있으며, UI에서 값 변경 시 IK 요청에 포함됩니다.

## 시작하기

프로젝트를 로컬 환경에서 실행하려면 다음 단계를 따르세요.

### 사전 요구 사항

- [Node.js](https://nodejs.org/) (버전 18.x 이상 권장)
- [yarn](https://yarnpkg.com/) 또는 npm

### 설치

저장소를 클론하고 필요한 종속성을 설치합니다.

```bash
git clone <repository-url>
cd enterprise-binpicking-dt
yarn install
# 또는 npm install
```

### 개발 서버 실행

다음 명령어를 사용하여 개발 서버를 시작합니다.

```bash
yarn dev
# 또는 npm run dev
```

서버가 시작되면 브라우저에서 `http://localhost:3000`으로 접속하여 애플리케이션을 확인할 수 있습니다.

## 환경 변수

프로젝트 루트에 `.env.local` 파일을 생성하고 필요한 환경 변수를 설정하세요.

```bash
# IKPy 백엔드 프록시 대상 (필요에 따라 교체)
ROBOT_IK_IKPY_ENDPOINT=http://192.168.0.196:53000/api/robot/ik/ikpy
ROBOT_IK_IKPY_DOWNWARD_ENDPOINT=http://192.168.0.196:53000/api/robot/ik/ikpy/downward

# OPC UA 관련 API 엔드포인트가 별도로 있다면 추가 선언
# OPCUA_READ_ENDPOINT=...
# OPCUA_WRITE_ENDPOINT=...
```

프록시 주소를 변경한 경우 개발 서버를 재시작해야 합니다.

## 구조 개요

```
src/
├─ app/
│  ├─ layout.tsx             # 최상위 레이아웃
│  ├─ page.tsx               # 루트 페이지
│  ├─ landing/               # 랜딩 페이지
│  ├─ robot-dt/              # 로봇 디지털 트윈 화면
│  │  ├─ components/         # RobotViewer, Pose Panel 등
│  │  └─ lib/                # IK 자동 요청 유틸
│  ├─ robot-path-learning/   # 다중 로봇 경로 학습 화면
│  ├─ image-viewer/          # 실시간 이미지 뷰어
│  └─ api/                   # Next.js Edge/Route Handler
├─ components/               # 공통 컴포넌트, 3D 씬 등
├─ stores/                   # Zustand 상태 관리
└─ lib/                      # OPC-UA, YCB 데이터 유틸
```

핵심 상태는 `src/stores`에 있는 Zustand 스토어로 관리합니다. 예를 들어 `robotControlStore` 는 관절 각도, 그리퍼 길이, IK 상태 등을 보관합니다.

## IK 요청 흐름

1. 슬라이더/토글 변경 → `performIkAutoSolve()` 호출.
2. `/api/robot/ik/ikpy` 혹은 `/api/robot/ik/ikpy/downward` 프록시로 요청 전송.
3. 백엔드가 404를 반환하면 자동으로 `/api/robot/ik` / `/api/robot/ik/downward` 로 재시도.
4. 성공 시 `best.joint_positions` 값을 라디안에서 도 단위로 변환해 디지털 트윈 상태를 갱신.

`grip_offsets` 는 TCP-플랜지 간 거리(미터)를 담은 스칼라 배열이며, 기본 그리퍼 길이(240 mm)는 자동으로 환산되어 포함됩니다.

## 기타 참고

- 디지털 트윈에서 사용되는 로봇 위치는 실시간 WebSocket 데이터(로봇 좌표계 기준)로부터 바로 적용됩니다. 별도의 하드코딩 오프셋은 없으며 서버 측 `robot_position.json` 설정이 바뀌면 자동으로 반영됩니다.
- 스타일/레이아웃 변경 후에는 `npm run lint` 로 ESLint 경고를 확인하세요. 일부 경고(`no-unused-vars`, `exhaustive-deps`)는 기존 파일에 남아 있습니다.
- 자산(이미지, URDF, YCB 데이터)은 `public/` 디렉터리에 위치하며 Next.js `publicPath` 를 통해 제공됩니다.

필요한 내용이 더 있다면 README와 문서를 계속 업데이트해 주세요.
