## RSS API 사용 가이드

- **대상**: `Main_Server`의 `/api/v1/workflow/full-pipeline-from-rss` 엔드포인트를 통해 RSS 서버로부터 RGB/Depth 스트림을 직접 수집하고 전체 파이프라인(ISM → PEM)을 실행하려는 경우
- **구성 요소**: FastAPI 기반 메인 서버, RSS 스트림 서버, ISM 서버, PEM 서버, 공유 `static` 디렉터리

### 선행 준비
- `Main_Server`, `ISM_Server`, `PEM_Server`, `RSS` 서버가 모두 실행 중이어야 한다.
- 운영 모드는 `.env` 선택에 따라 결정된다(`APP_ENV=dev|prod`). 프로덕션 모드에서는 `run_server.bat`/`.sh` 사용.
- Docker Compose 환경에서는 `ISM_MAX_CACHE_SIZE=25`, `PEM_TEMPLATE_CACHE_MAX=25`, `PEM_CAD_CACHE_MAX=25`, `PEM_PRELOAD_TEMPLATES=true`가 자동으로 설정된다.
- 결과물은 항상 `static/output/<timestamp>_<request_tag>/` 하위에 생성되며, API 종류별 태그가 붙는다.

### 엔드포인트 개요
- **HTTP Method**: `POST`
- **URL**: `http://<MAIN_SERVER_HOST>:8001/api/v1/workflow/full-pipeline-from-rss`
- **요청 모델**: `RssFullPipelineRequest`

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `class_name` | `string` | ✅ | 객체 클래스 (예: `ycb`) |
| `object_name` | `string` | ✅ | 객체 이름 (예: `obj_000002`) |
| `base` | `string` | ❌ | RSS 서버의 기본 URL. 지정 시 `host`/`port` 대신 사용 (예: `http://localhost:5000`) |
| `host` | `string` | ❌ | RSS 서버 호스트 (예: `localhost`). `base`가 비어 있을 때만 사용 |
| `port` | `int` | ❌ | RSS 서버 포트 (예: `5000`) |
| `align_color` | `bool` | ❌ | 색상 카메라 기준으로 depth 정합 수행 여부. 기본 `false` |
| `frame_guess` | `bool` | ❌ | 카메라 프레임 유추(보정 회전 후보 적용) 활성화 |
| `output_dir` | `string` | ❌ | 사용자 지정 출력 경로. 비우면 타임스탬프 기반 디렉터리를 자동 생성 |
| `save_outputs` | `bool` | ❌ | (이전 호환) `false`면 파일을 남기지 않음. `output_mode="none"`과 동일 |
| `output_mode` | `string` | ❌ | 출력 전략(`full`, `results_only`, `none`). 기본값 `full` |

> `base`를 지정하면 내부적으로 `base/streams/...` 경로가 사용된다. `base`가 없으면 `host`와 `port`로 URL을 조합한다.

#### 출력 모드 선택

- **full**: 입력 데이터, ISM/PEM 원본 응답, 시각화 이미지, 메타데이터까지 모두 저장
- **results_only**: 최종 포즈 요약(`pose_results.json`)만 저장, 중간 산출물은 생략
- **none**: 어떠한 파일도 생성하지 않고 API 응답만 반환 (`save_outputs=false`와 동일)

### 요청 절차
1. 요청 수신 직후 RSS 서버에서 `status`, `calib`, `color_jpeg`, `color_raw`, `depth_raw` 스트림을 순차로 가져온다.
2. `align_color`가 `true`이고 정합용 extrinsics가 제공되면 depth를 컬러 프레임에 맞춰 재투영한다.
3. 카메라 파라미터(`cam_K`, `depth_scale`)를 구성하고 내부 `execute_full_pipeline`으로 전달한다.
4. ISM → PEM 순서로 추론을 진행하고 결과물을 `static/output` 하위에 저장한 뒤 응답을 반환한다.

### 예시 요청

#### cURL
```bash
curl -X POST "http://localhost:8001/api/v1/workflow/full-pipeline-from-rss" \
  -H "Content-Type: application/json" \
  -d '{
        "class_name": "ycb",
        "object_name": "obj_000002",
        "base": "http://localhost:5000",
        "align_color": true,
        "frame_guess": true,
        "output_mode": "results_only"
      }'
```

#### Python (`requests`)
```python
import requests

payload = {
    "class_name": "ycb",
    "object_name": "obj_000002",
    "base": "http://localhost:5000",
    "align_color": True,
    "frame_guess": True,
    "output_mode": "none",
    "request_tag": "rss-sample"
}

resp = requests.post(
    "http://localhost:8001/api/v1/workflow/full-pipeline-from-rss",
    json=payload,
    timeout=900,
)

print(resp.status_code)
print(resp.json())
```

> `request_tag`는 API 모델에는 없지만 `workflow_service`에서 추가 인자로 전달할 수 있다. 값을 넘기면 출력 폴더 이름에 `_rss-sample`과 같이 붙는다.

### 응답 형식 (요약 JSON)

파이프라인이 완료되면 6D 포즈 결과만 담은 간소한 JSON이 반환된다.

```json
{
  "success": true,
  "message": "Pipeline execution completed",
  "results": {
    "pose_results": [
      {
        "index": 0,
        "score": 0.0811,
        "rotation": [[...], [...], [...]],
        "translation": [185.77, -156.90, 950.11]
      },
      ...
    ],
    "num_poses": 5,
    "output_dir": "C:\\CD\\PROJECT\\BINPICKING\\Estimation_Server\\static\\output\\20251031_144911_api-full-pipeline-from-rss",
    "request_tag": "api-full-pipeline-from-rss"
  }
}
```

- `pose_results`: 점수(`score`), 회전 행렬(`rotation`), 위치(`translation`)로 구성된 6D 포즈 리스트
- `num_poses`: 응답에 포함된 포즈 개수
- `output_dir`: 원본 ISM/PEM 로그 파일(`pem_server_response.json`, `ism_server_response.json` 등)이 저장된 경로 (`output_mode`가 `results_only`이면 요약만, `none`이면 `null`)
- 실패 시에는 `success: false`와 함께 `results.error` 필드에 오류 메시지가 포함된다.

### 생성되는 산출물

`static/output/20251031_121911_api-full-pipeline-from-rss/` (※ `output_mode=full` 기준)

- `camera_params.json`: 최종 `cam_K`, `depth_scale` 기록
- `input_rgb.png`, `input_depth.png`: RSS에서 수집한 입력 영상
- `pipeline_metadata.json`: 파이프라인 단위 요약(성공 여부, 소요 시간, 템플릿 사용 경로 등)
- `ism/`
  - `detection_ism.json`: Focal, bbox, mask counts 등 ISM 추론 결과
  - `vis_ism.png`: 탐지 결과 시각화
- `pem/`
  - `detection_pem.json`: 최종 pose, score, model_points
  - `vis_pem.png`: 2D projection 오버레이
- `pem_server_response.json`: PEM 서버 원본 응답 (회전/병진 행렬, 점군 경로 포함)

`results_only` 모드에서는 같은 경로에 `pose_results.json`만 저장되고, `none` 모드에서는 디스크에 아무 파일도 생성하지 않는다.

### 배치 테스트 스크립트

- 다수의 객체를 연속으로 추론하려면 `Main_Server/scripts/run_rss_batch_ycb.py`를 실행한다.
- 스크립트는 `obj_000001`부터 `obj_000025`까지 순차로 API를 호출하고, 성공/실패 및 `output_dir`을 로그로 출력한다.
- 실행 전 메인/ISM/PEM/RSS 서버가 모두 준비되어 있는지 확인한다.

```python
python Main_Server/scripts/run_rss_batch_ycb.py
```

실행 결과 요약은 `Main_Server/rss_batch_summary.json`에 기록되며, 각 객체별 HTTP 상태, ISM/PEM 성공 여부, 추론 시간 등을 포함한다.

### 장애 대응 팁
- 포트 충돌(`WinError 10048`)이 발생하면 기존 `uvicorn` 프로세스를 종료 후 재시작한다.
- `watchfiles` 디버그 로그가 지속되면 `APP_ENV=prod`로 실행해 자동 리로드를 비활성화한다.
- RSS 서버 연결 실패 시 `base` URL, 인증, 방화벽 설정을 우선 확인한다.
- 추론이 느릴 경우 캐시 선로딩(`PEM_PRELOAD_TEMPLATES`, `ISM_PRELOAD_TEMPLATES`)이 활성화돼 있는지 확인하고, I/O 병목은 RSS 스트림 → PNG 변환 구간을 점검한다.

### 참고
- API 스키마: `Main_Server/api/models.py`
- 로직 구현: `Main_Server/services/workflow_service.py`
- 출력 경로: `static/output/<timestamp>_<tag>/`
- 로컬/컨테이너 경로 차이가 있을 수 있으므로, Docker 환경에서는 `/workspace/Estimation_Server/...` 형태로 기록된다.

### 6D 포즈 요약 응답 활용

`/api/v1/workflow/full-pipeline-from-rss`는 파이프라인 완료 후 아래처럼 **간소화된 포즈 정보만** 내려준다.

```json
{
  "success": true,
  "message": "Pipeline execution completed",
  "results": {
    "pose_results": [
      {
        "index": 0,
        "score": 0.0811,
        "rotation": [[...], [...], [...]],
        "translation": [185.77, -156.90, 950.11]
      },
      ...
    ],
    "num_poses": 5,
    "output_dir": "C:\\CD\\PROJECT\\...",
    "request_tag": "api-full-pipeline-from-rss"
  }
}
```

- `pose_results[index]`: 각 후보 6D pose (점수·회전·평행이동)
- `num_poses`: 반환된 포즈 수
- `output_dir`: 정밀 로그(`pem_server_response.json` 등)가 저장된 위치 (`output_mode=none`이면 `null`)

#### PowerShell/Windows에서 JSON 저장 예시

```powershell
cd C:\CD\PROJECT\BINPICKING\Estimation_Server
python - <<'PY'
import requests, json
url = "http://localhost:8001/api/v1/workflow/full-pipeline-from-rss"
payload = {
    "class_name": "ycb",
    "object_name": "obj_000002",
    "align_color": True,
    "frame_guess": True,
    "output_mode": "results_only"
}
resp = requests.post(url, json=payload, timeout=900)
data = resp.json()
with open("pose_results_api.json", "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
print("Status:", resp.status_code)
print("Saved to pose_results_api.json")
PY
```

`pose_results_api.json`에는 앞서 소개한 요약 구조가 그대로 저장된다(`output_mode`에 따라 `results.output_dir`는 `null`일 수 있다).

#### Python 코드에서 직접 활용

```python
import requests

payload = {
    "class_name": "ycb",
    "object_name": "obj_000002",
    "align_color": True,
    "frame_guess": True,
    "output_mode": "none"
}
resp = requests.post("http://localhost:8001/api/v1/workflow/full-pipeline-from-rss", json=payload, timeout=900)
resp.raise_for_status()
pose_results = resp.json()["results"]["pose_results"]
for pose in pose_results:
    print(pose["score"], pose["rotation"], pose["translation"])
```

#### 주의 사항
- 포즈 결과 외의 세부 로그(세그멘테이션 마스크, 템플릿 사용 경로 등)는 `static/output/<timestamp>_<tag>/` 아래 파일들을 직접 열어 확인한다.
- 프론트엔드에서 JSON 직렬화 시 길이 제한을 피하려면 `pose_results`만 사용하고, 필요 시 파일 로그를 참조한다.

