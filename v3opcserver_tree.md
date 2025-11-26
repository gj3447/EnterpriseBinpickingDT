## OPC UA Commands/Gripper 트리 재생성 & NodeId 동기화 가이드

서버(v3 Gateway)에서 Commands/Gripper 노드의 Numeric NodeId가 변경되면, 아래 절차로 최신 트리를 덤프하고 문서·코드에 반영한다.

### 1. 전제 조건
- Next.js dev 서버(`npm run dev`)가 로컬에서 실행 중이어야 `/api/opcua/tree` 라우트를 호출할 수 있다.
- OPC 게이트웨이(v3)가 기동 상태여야 하고, 외부에서 `opc.tcp://…` 로 접근 가능해야 한다.

### 2. PowerShell에서 Commands 트리 덤프 생성
```powershell
$body = @{
  startNodeId        = "ns=2;i=3"   # Commands
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
- 출력 파일(`v3opcserver_commands_tree.json`)에는 Commands 폴더의 하위 변수와 `dataType`/`nodeId` 정보가 포함된다.
- 필요 시 `startNodeId`를 `ns=2;i=4`(Gripper) 등으로 바꿔 특정 서브트리만 추출할 수 있다.

### 3. NodeId 비교 및 클라이언트 재배치
1. JSON에서 `TargetJoints`, `Mode`, `JVel`, `Trigger`, `Gripper.Commands.Open/Close` 등 핵심 노드의 `nodeId`를 확인한다. (예: `ns=2;i=52` 등)
2. 아래 파일에서 동일한 NodeId를 사용하고 있는지 확인하고, 다르면 JSON 값으로 갱신한다.
   - `opc_tags.md` (문서 트리/표)
   - `v3opcserver_arch.md` (NodeId 표, PowerShell 스크립트 안내)
   - `src/stores/opcUaStore.ts` (`COMMAND_NODE_IDS`)
   - `src/lib/opcuaNodeMeta.ts` (Variant 타입 메타)
3. 변경 후 `npm run lint`로 포맷/타입 오류가 없는지 확인하고, 실제 OPC 서버에 쓰기 테스트(PUSH 버튼, `curl /api/opcua/write`)를 수행한다.

### 4. 재배치 기록
- NodeId가 변경될 때마다 `v3opcserver_commands_tree.json`을 리포지토리에 함께 커밋하면, 어느 시점에 어떤 값이었는지 추적하기 쉽다.
- 문서(`v3opcserver_arch.md`)의 “Commands/Gripper Numeric NodeId” 표를 최신 값으로 유지하고, 재생성 방법(본 문서)을 참고하도록 링크한다.

이 절차를 따르면 OPC 서버 NodeId가 다시 바뀌더라도 클라이언트/문서와 즉시 동기화할 수 있다.