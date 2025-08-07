# Enterprise BinPicking DT

이 프로젝트는 엔터프라이즈 빈 피킹(Bin Picking) 로봇 시스템의 디지털 트윈(Digital Twin)을 위한 웹 애플리케이션입니다. 로봇의 상태, 경로 학습 과정, 실시간 카메라 피드 등 다양한 데이터를 시각화하고 모니터링하는 기능을 제공합니다.

## 주요 기능

- **제품 소개 페이지 (`/landing`):** 서비스의 핵심 기능과 가치를 소개하는 랜딩 페이지입니다.
- **로봇 DT 페이지 (`/robot-dt`):** 단일 로봇의 상태를 디지털 트윈으로 실시간 모니터링합니다.
- **로봇 경로 학습 페이지 (`/robot-path-learning`):** 여러 로봇의 경로 학습 과정을 동시에 시각화하여 보여줍니다.
- **실시간 이미지 뷰어 (`/image-viewer`):** 4개의 개별 웹소켓 스트림(Color, Depth, ArUco Debug, Board Perspective)을 통해 실시간 카메라 피드를 제공합니다. 특히 `Board Perspective` 뷰는 고유한 비율을 유지하며 강조 표시됩니다.

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
