"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import * as THREE from "three";

import type { YcbObjectData } from "@/lib/ycb";
import { useInferenceStore } from "@/stores/inferenceStore";

interface YcbObjectViewerProps {
  objects: YcbObjectData[];
  variant?: "page" | "panel";
}

interface InferenceSummary {
  objectName: string;
  score: number;
  message?: string;
  rawResponse: unknown;
  mode: InferenceMode;
}

const MAIN_SERVER_URL =
  process.env.NEXT_PUBLIC_MAIN_SERVER_URL ?? "http://192.168.0.196:8001";
const RSS_BASE_URL =
  process.env.NEXT_PUBLIC_RSS_BASE ?? "http://192.168.0.197:51000";
const STREAM_WS_BASE =
  process.env.NEXT_PUBLIC_STREAM_WS_BASE ?? "ws://192.168.0.196:53000";

const BOARD_PERSPECTIVE_ENDPOINT = "/ws/board_perspective_jpg";
const RECONNECT_INTERVAL_MS = 1000;

type ConnectionState = "connecting" | "open" | "closed";
type InferenceMode = "full" | "fast";

function BoardPerspectivePreview() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [status, setStatus] = useState<ConnectionState>("connecting");

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let isUnmounted = false;

    const clearReconnectTimer = () => {
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const connect = () => {
      if (isUnmounted) {
        return;
      }

      clearReconnectTimer();
      setStatus("connecting");
      ws = new WebSocket(`${STREAM_WS_BASE}${BOARD_PERSPECTIVE_ENDPOINT}`);

      ws.onopen = () => {
        if (isUnmounted) {
          ws?.close();
          return;
        }
        setStatus("open");
      };

      const scheduleReconnect = () => {
        if (isUnmounted) {
          return;
        }
        setStatus("closed");
        clearReconnectTimer();
        reconnectTimer = window.setTimeout(connect, RECONNECT_INTERVAL_MS);
      };

      ws.onclose = () => {
        scheduleReconnect();
      };

      ws.onerror = () => {
        scheduleReconnect();
      };

      ws.onmessage = (event) => {
        if (event.data instanceof Blob) {
          const reader = new FileReader();
          reader.onload = (e) => {
            if (isUnmounted) {
              return;
            }
            const result = e.target?.result;
            if (typeof result === "string") {
              setImageSrc(result);
            }
          };
          reader.readAsDataURL(event.data);
        }
      };
    };

    connect();

    return () => {
      isUnmounted = true;
      clearReconnectTimer();
      ws?.close();
    };
  }, []);

  return (
    <section className="bg-neutral-800/70 border border-neutral-700 rounded-2xl shadow-lg overflow-hidden">
      <header className="px-5 py-3 flex items-center justify-between bg-neutral-800/80 border-b border-neutral-700/80">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-neutral-100">
            카메라 전면 보정 뷰 (Board Perspective)
          </span>
          <span
            className={`inline-flex items-center gap-1 text-xs uppercase tracking-widest font-semibold px-2 py-0.5 rounded-full border ${
              status === "open"
                ? "border-emerald-500/40 text-emerald-200 bg-emerald-500/10"
                : status === "connecting"
                ? "border-amber-500/40 text-amber-200 bg-amber-500/10"
                : "border-red-500/40 text-red-200 bg-red-500/10"
            }`}
          >
            {status === "open"
              ? "Live"
              : status === "connecting"
              ? "Connecting"
              : "Disconnected"}
          </span>
        </div>
        <span className="text-xs text-neutral-500">{STREAM_WS_BASE}{BOARD_PERSPECTIVE_ENDPOINT}</span>
      </header>

      <div className="bg-neutral-900/80 flex items-center justify-center min-h-[220px]">
        {imageSrc ? (
          <img
            src={imageSrc}
            alt="Board Perspective"
            className="max-h-[240px] w-full object-contain rotate-180 -scale-x-100"
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-neutral-400 text-sm">
            <div className="flex gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-neutral-500 animate-ping"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-neutral-500 animate-ping" style={{ animationDelay: "0.15s" }}></div>
              <div className="w-2.5 h-2.5 rounded-full bg-neutral-500 animate-ping" style={{ animationDelay: "0.3s" }}></div>
            </div>
            <span>
              {status === "connecting"
                ? "보정 이미지 스트림에 연결 중..."
                : status === "open"
                ? "이미지를 수신하는 중..."
                : "보정 이미지 스트림을 수신할 수 없습니다."}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

const DEFAULT_QUATERNION: [number, number, number, number] = [0, 0, 0, 1];

export function YcbObjectViewer({ objects, variant = "page" }: YcbObjectViewerProps) {
  const [selectedName, setSelectedName] = useState(
    objects.length > 0 ? objects[0].name : ""
  );

  const selectedObject = useMemo(() => {
    return objects.find((object) => object.name === selectedName) ?? null;
  }, [objects, selectedName]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [inferenceSummary, setInferenceSummary] = useState<InferenceSummary | null>(null);
  const [lastResponse, setLastResponse] = useState<string | null>(null);
  const [inferenceMode, setInferenceMode] = useState<InferenceMode>("full");

  const upsertInference = useInferenceStore((state) => state.upsertInference);
  const clearInference = useInferenceStore((state) => state.clearInference);

  const imageCount = selectedObject?.images.length ?? 0;

  useEffect(() => {
    setCurrentIndex(0);
  }, [selectedObject?.name]);

  useEffect(() => {
    if (!selectedObject || imageCount === 0) {
      return;
    }

    const displayDuration = variant === "panel" ? 1200 : 1600;

    const interval = window.setInterval(() => {
      setCurrentIndex((prev) => {
        if (imageCount === 0) {
          return 0;
        }

        return (prev + 1) % imageCount;
      });
    }, displayDuration);

    return () => window.clearInterval(interval);
  }, [imageCount, selectedObject, variant]);

  const currentImage = selectedObject && imageCount > 0
    ? selectedObject.images[currentIndex % imageCount]
    : null;

  const isFastMode = inferenceMode === "fast";
  const inferenceButtonLabel = isLoading
    ? "추론 중..."
    : isFastMode
    ? "빠른 추론 시작"
    : "느린 추론 시작";

  const handleInference = useCallback(async () => {
    if (!selectedObject) {
      return;
    }

    const currentInference = useInferenceStore.getState().inferences[selectedObject.name];
    if (currentInference) {
      clearInference(selectedObject.name);
    }
    setIsLoading(true);
    setErrorMessage(null);
    setInferenceSummary(null);
    setLastResponse(null);

    try {
      const outputMode = inferenceMode === "fast" ? "none" : "full";
      const requestTag = inferenceMode === "fast" ? "fast-inference" : "full-inference";

      const payload: Record<string, unknown> = {
        class_name: "ycb",
        object_name: selectedObject.name,
        base: RSS_BASE_URL,
        align_color: true,
        frame_guess: true,
        output_mode: outputMode,
        request_tag: requestTag,
      };

      if (inferenceMode === "fast") {
        payload.save_outputs = false;
      }

      const response = await fetch(
        `${MAIN_SERVER_URL}/api/v1/workflow/full-pipeline-from-rss`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const responseClone = response.clone();
      let responseText: string | null = null;
      let responseJson: unknown = null;

      try {
        responseText = await responseClone.text();
        responseJson = responseText ? JSON.parse(responseText) : null;
      } catch {
        responseJson = null;
      }

      if (!response.ok) {
        setLastResponse(
          typeof responseText === "string"
            ? responseText
            : responseJson
              ? (() => {
                  try {
                    return JSON.stringify(responseJson);
                  } catch {
                    return "응답 본문을 문자열로 변환하지 못했습니다.";
                  }
                })()
              : "응답 본문이 없습니다."
        );
        throw new Error(`HTTP ${response.status}`);
      }

      const data =
        responseJson && typeof responseJson === "object"
          ? responseJson
          : await response.json();

      setLastResponse(
        typeof responseText === "string"
          ? responseText
          : (() => {
              try {
                return JSON.stringify(data);
              } catch {
                return "응답을 문자열로 변환하지 못했습니다.";
              }
            })()
      );
      const meshPath = `/meshs/${selectedObject.name}.obj`;

      const convertRotationCandidateToQuaternion = (
        candidate: unknown
      ): [number, number, number, number] => {
        let matrix4: THREE.Matrix4 | null = null;

        if (Array.isArray(candidate)) {
          const first = candidate[0];
          if (
            Array.isArray(first) &&
            first.length === 3 &&
            candidate.length === 3
          ) {
            const basis = candidate as number[][];
            matrix4 = new THREE.Matrix4().set(
              Number(basis[0][0]),
              Number(basis[0][1]),
              Number(basis[0][2]),
              0,
              Number(basis[1][0]),
              Number(basis[1][1]),
              Number(basis[1][2]),
              0,
              Number(basis[2][0]),
              Number(basis[2][1]),
              Number(basis[2][2]),
              0,
              0,
              0,
              0,
              1
            );
          } else if (candidate.length === 9) {
            const flat = candidate as number[];
            matrix4 = new THREE.Matrix4().set(
              Number(flat[0]),
              Number(flat[1]),
              Number(flat[2]),
              0,
              Number(flat[3]),
              Number(flat[4]),
              Number(flat[5]),
              0,
              Number(flat[6]),
              Number(flat[7]),
              Number(flat[8]),
              0,
              0,
              0,
              0,
              1
            );
          }
        }

        if (matrix4) {
          const quat = new THREE.Quaternion().setFromRotationMatrix(matrix4);
          return [quat.x, quat.y, quat.z, quat.w];
        }

        return DEFAULT_QUATERNION;
      };

      const results = data?.results ?? {};
      let bestScore = Number.NEGATIVE_INFINITY;
      let translation: [number, number, number] | null = null;
      let quaternion: [number, number, number, number] = DEFAULT_QUATERNION;
      let hasPose = false;

      if (Array.isArray(results?.pose_results) && results.pose_results.length > 0) {
        const poseResultsRaw = results.pose_results as unknown[];
        let bestIndex = 0;

        poseResultsRaw.forEach((poseEntry, index) => {
          if (poseEntry && typeof poseEntry === "object") {
            const candidateScore = Number(
              (poseEntry as { score?: unknown }).score
            );
            if (Number.isFinite(candidateScore) && candidateScore > bestScore) {
              bestScore = candidateScore;
              bestIndex = index;
            }
          }
        });

        if (!Number.isFinite(bestScore)) {
          bestScore = Number(
            (poseResultsRaw[bestIndex] as { score?: unknown })?.score ?? 0
          );
        }

        const bestPoseRaw = poseResultsRaw[bestIndex];
        if (!bestPoseRaw || typeof bestPoseRaw !== "object") {
          throw new Error("유효한 추론 포즈 정보를 찾을 수 없습니다.");
        }

        const bestPose = bestPoseRaw as {
          translation?: unknown;
          rotation?: unknown;
        };
        const translationRaw = Array.isArray(bestPose.translation)
          ? bestPose.translation
          : null;

        if (!translationRaw || translationRaw.length < 3) {
          throw new Error("추론 위치 정보를 찾을 수 없습니다.");
        }

        translation = [
          Number(translationRaw[0]) / 1000,
          Number(translationRaw[1]) / 1000,
          Number(translationRaw[2]) / 1000,
        ];

        quaternion = convertRotationCandidateToQuaternion(bestPose?.rotation);
        hasPose = true;
      } else {
        const pem = results?.pipeline?.pem;

        if (pem?.success === false) {
          const reason =
            typeof pem?.message === "string" && pem.message.trim().length > 0
              ? pem.message
              : "PEM 파이프라인이 실패했습니다.";
          throw new Error(reason);
        }

        if (typeof pem?.num_detections === "number" && pem.num_detections <= 0) {
          throw new Error("PEM 파이프라인에서 유효한 추론이 생성되지 않았습니다.");
        }

        const scores: unknown = pem?.pose_scores ?? pem?.scores;
        if (!Array.isArray(scores) || scores.length === 0) {
          const fallbackMessage =
            typeof pem?.message === "string" && pem.message.trim().length > 0
              ? pem.message
              : "추론 점수를 찾을 수 없습니다.";
          throw new Error(fallbackMessage);
        }

        let bestIndex = 0;
        scores.forEach((score, index) => {
          if (typeof score === "number" && score > bestScore) {
            bestScore = score;
            bestIndex = index;
          }
        });

        if (!Number.isFinite(bestScore)) {
          throw new Error("유효한 추론 점수가 없습니다.");
        }

        const translations: unknown = pem?.pred_trans ?? pem?.translations;
        const translationRaw =
          Array.isArray(translations) && translations.length > bestIndex
            ? translations[bestIndex]
            : null;

        if (!Array.isArray(translationRaw) || translationRaw.length < 3) {
          throw new Error("추론 위치 정보를 찾을 수 없습니다.");
        }

        translation = [
          Number(translationRaw[0]) / 1000,
          Number(translationRaw[1]) / 1000,
          Number(translationRaw[2]) / 1000,
        ];

        const quaternions: unknown =
          pem?.pred_quat ?? pem?.quaternions ?? pem?.pred_quaternion;
        if (
          Array.isArray(quaternions) &&
          quaternions.length > bestIndex &&
          Array.isArray(quaternions[bestIndex]) &&
          quaternions[bestIndex].length >= 4
        ) {
          const [qx, qy, qz, qw] = quaternions[bestIndex] as number[];
          quaternion = [
            Number(qx ?? 0),
            Number(qy ?? 0),
            Number(qz ?? 0),
            Number(qw ?? 1),
          ];
        } else if (Array.isArray(pem?.pred_rot) && pem?.pred_rot.length > bestIndex) {
          quaternion = convertRotationCandidateToQuaternion(
            pem.pred_rot[bestIndex]
          );
        }

        hasPose = true;
      }

      if (!Number.isFinite(bestScore)) {
        const fallbackMessage =
          typeof data?.message === "string" && data.message.trim().length > 0
            ? data.message
            : "추론 점수를 찾을 수 없습니다.";
        throw new Error(fallbackMessage);
      }

      if (!hasPose || !translation) {
        const fallbackMessage =
          typeof data?.message === "string" && data.message.trim().length > 0
            ? data.message
            : "추론 결과를 구성할 수 없습니다.";
        throw new Error(fallbackMessage);
      }

      upsertInference({
        objectName: selectedObject.name,
        score: bestScore,
        meshPath,
        pose: {
          position: translation,
          quaternion,
        },
        timestamp: Date.now(),
        rawResponse: data,
        mode: inferenceMode,
      });

      setInferenceSummary({
        objectName: selectedObject.name,
        score: bestScore,
        message:
          typeof results?.message === "string" && results.message.trim().length > 0
            ? results.message
            : data?.message ?? undefined,
        rawResponse: data,
        mode: inferenceMode,
      });
    } catch (error) {
      console.error("RSS 추론 요청 실패", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "추론 중 알 수 없는 오류가 발생했습니다."
      );
      clearInference(selectedObject.name);
    } finally {
      setIsLoading(false);
    }
  }, [selectedObject, upsertInference, clearInference, inferenceMode]);

  const isPanel = variant === "panel";

  const containerClass = isPanel
    ? "h-full bg-neutral-900 text-neutral-100 px-3 py-4 overflow-y-auto"
    : "min-h-screen bg-neutral-900 text-neutral-100 px-6 py-10";

  const contentClass = isPanel
    ? "space-y-5"
    : "max-w-5xl mx-auto space-y-10";

  const titleClass = isPanel
    ? "text-2xl font-semibold tracking-tight"
    : "text-4xl font-semibold tracking-tight";

  const descriptionClass = isPanel
    ? "text-neutral-400 text-sm"
    : "text-neutral-400 text-base max-w-2xl";

  const cardHeaderPaddingClass = isPanel
    ? "p-5 border-b border-neutral-700 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
    : "p-6 border-b border-neutral-700 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between";

  const modeSelectorPaddingClass = isPanel
    ? "px-5 pb-5 border-b border-neutral-800"
    : "px-6 pb-6 border-b border-neutral-800";

  const cardBodyPaddingClass = isPanel
    ? "p-5 space-y-3"
    : "p-6 space-y-4";

  const statusBlockPaddingClass = isPanel
    ? "px-5 py-4 border-b border-neutral-800 space-y-2"
    : "px-6 py-4 border-b border-neutral-800 space-y-2";

  return (
    <div className={containerClass}>
      <div className={contentClass}>
        {variant !== "panel" && <BoardPerspectivePreview />}

        <header className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h1 className={titleClass}>YCB 객체 선택</h1>
            {selectedObject && (
              <span className="text-xs font-medium uppercase tracking-wider text-neutral-400 bg-neutral-800 px-3 py-1 rounded-full border border-neutral-700">
                {selectedObject.name}
              </span>
            )}
          </div>
          <p className={descriptionClass}>
            `public/ycb_images`에 저장된 물체 중에서 추론을 진행할 후보를 선택하세요.
            콤보박스에서 물체를 선택하면 해당 폴더의 `rgb_*.png` 이미지가 순차적으로
            표시됩니다.
          </p>
        </header>

        <section className="bg-neutral-800/70 border border-neutral-700 rounded-2xl shadow-lg">
          <div className={cardHeaderPaddingClass}>
            <div className="flex flex-col gap-2">
              <label
                htmlFor="object-select"
                className="text-sm uppercase tracking-wide text-neutral-400"
              >
                물체 선택
              </label>
              <select
                id="object-select"
                className="bg-neutral-900 border border-neutral-700 rounded-lg px-4 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 w-full lg:w-64"
                value={selectedName}
                onChange={(event) => setSelectedName(event.target.value)}
                disabled={isLoading}
              >
                {objects.map((object) => (
                  <option key={object.name} value={object.name}>
                    {object.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleInference}
              className="self-start lg:self-center bg-blue-500 text-white font-medium tracking-wide px-5 py-2 rounded-full transition-colors hover:bg-blue-400 disabled:bg-neutral-600 disabled:cursor-not-allowed"
              disabled={!selectedObject || isLoading}
            >
              {inferenceButtonLabel}
            </button>
          </div>

          <div className={modeSelectorPaddingClass}>
            <div className="flex flex-col gap-2 w-full lg:w-auto">
              <span className="text-sm uppercase tracking-wide text-neutral-400">
                추론 모드
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={`px-4 py-1 text-xs font-semibold rounded-full border transition-colors whitespace-nowrap ${
                    inferenceMode === "full"
                      ? "bg-neutral-200 text-neutral-900 border-neutral-200"
                      : "text-neutral-200 border-neutral-600 hover:border-neutral-400"
                  }`}
                  onClick={() => setInferenceMode("full")}
                  disabled={isLoading}
                >
                  느린 추론 (이미지 포함)
                </button>
                <button
                  type="button"
                  className={`px-4 py-1 text-xs font-semibold rounded-full border transition-colors whitespace-nowrap ${
                    inferenceMode === "fast"
                      ? "bg-neutral-200 text-neutral-900 border-neutral-200"
                      : "text-neutral-200 border-neutral-600 hover:border-neutral-400"
                  }`}
                  onClick={() => setInferenceMode("fast")}
                  disabled={isLoading}
                >
                  빠른 추론 (값만)
                </button>
              </div>
              <p className="text-xs text-neutral-500">
                느린 추론은 보정/시각화 이미지를 생성하며 더 오래 걸립니다. 빠른 추론은 포즈 값만 반환합니다.
              </p>
            </div>
          </div>

          {(inferenceSummary || errorMessage || isLoading) && (
            <div className={statusBlockPaddingClass}>
              {isLoading && (
                <p className="text-sm text-neutral-300">RSS 파이프라인 실행 중...</p>
              )}
              {inferenceSummary && (
                <Fragment>
                  <div className="flex items-center justify-between text-sm text-neutral-200">
                    <div className="space-y-1">
                      <p className="font-semibold text-xl text-white">
                        최고 점수: {inferenceSummary.score.toFixed(5)}
                      </p>
                      <p className="text-neutral-400">
                        대상 객체: {inferenceSummary.objectName}
                      </p>
                    </div>
                    <span
                      className={`text-xs uppercase tracking-widest px-3 py-1 rounded-full border ${
                        inferenceSummary.mode === "fast"
                          ? "bg-emerald-500/10 text-emerald-200 border-emerald-500/40"
                          : "bg-blue-500/20 text-blue-200 border-blue-500/40"
                      }`}
                    >
                      {inferenceSummary.mode === "fast" ? "Fast" : "Full"}
                    </span>
                  </div>
                  {inferenceSummary.message && (
                    <p className="text-xs text-neutral-400">
                      서버 메시지: {inferenceSummary.message}
                    </p>
                  )}
                </Fragment>
              )}
              {errorMessage && (
                <p className="text-sm text-red-400">추론 실패: {errorMessage}</p>
              )}
            </div>
          )}

          <div className={cardBodyPaddingClass}>
            {selectedObject ? (
              currentImage ? (
                <figure
                  key={`${selectedObject.name}-${currentIndex}`}
                  className="bg-neutral-900/70 border border-neutral-800 rounded-xl overflow-hidden shadow-md"
                >
                  <div className="aspect-square bg-neutral-950 flex items-center justify-center relative">
                    <img
                      src={currentImage}
                      alt={`${selectedObject.name} rgb ${currentIndex + 1}`}
                      className="w-full h-full object-contain"
                    />
                    {imageCount > 1 && (
                      <div className="absolute bottom-3 right-3 text-xs font-semibold text-neutral-200 bg-neutral-900/80 backdrop-blur-sm px-2 py-1 rounded-full border border-neutral-700">
                        {currentIndex + 1} / {imageCount}
                      </div>
                    )}
                  </div>
                  <figcaption className="px-4 py-3 text-sm text-neutral-400 border-t border-neutral-800 flex items-center justify-between">
                    <span>{currentImage.split("/").pop()}</span>
                    {imageCount > 1 && (
                      <span className="font-medium text-neutral-300">
                        자동 순환 중
                      </span>
                    )}
                  </figcaption>
                </figure>
              ) : (
                <div className="text-center text-neutral-400 py-12 text-base">
                  `rgb_*.png` 이미지를 찾을 수 없습니다.
                </div>
              )
            ) : (
              <div className="text-center text-neutral-400 py-12 text-base">
                선택 가능한 물체가 없습니다.
              </div>
            )}

            {inferenceSummary && (
              <details className="bg-neutral-900/70 border border-neutral-800 rounded-xl p-4 text-sm text-neutral-200">
                <summary className="cursor-pointer font-semibold text-neutral-100">
                  전체 응답 확인
                </summary>
                <pre className="mt-3 whitespace-pre-wrap break-all text-xs bg-neutral-950 p-3 rounded-lg border border-neutral-800 overflow-x-auto">
{JSON.stringify(inferenceSummary.rawResponse, null, 2)}
                </pre>
              </details>
            )}
          </div>
        </section>

        {lastResponse !== null && lastResponse.length > 0 && (
          <section className="bg-neutral-900/70 border border-neutral-800 rounded-2xl shadow-lg px-6 py-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-neutral-300">
                최근 API 응답(JSON)
              </h2>
              <span className="text-xs text-neutral-500">최신 호출 기준</span>
            </div>
            <pre className="whitespace-pre-wrap break-all text-xs bg-neutral-950 p-3 rounded-lg border border-neutral-800 overflow-x-auto">
{lastResponse.length > 120000
  ? `${lastResponse.slice(0, 120000)}\n... (출력 길이 제한 120,000자 초과)`
  : lastResponse}
            </pre>
          </section>
        )}
      </div>
    </div>
  );
}


