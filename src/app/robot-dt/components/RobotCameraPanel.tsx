'use client';

import { useEffect, useMemo, useState } from 'react';

const STREAM_WS_BASE = process.env.NEXT_PUBLIC_STREAM_WS_BASE ?? 'ws://192.168.0.196:53000';
const RECONNECT_INTERVAL_MS = 1000;

type ConnectionState = 'connecting' | 'open' | 'closed';

interface CameraStreamConfig {
  id: CameraTab;
  label: string;
  path: string;
  description: string;
  transformClass?: string;
}

type CameraTab = 'calibration' | 'color';

interface RobotCameraPanelProps {
  variant?: 'panel' | 'overlay';
}

const CAMERA_STREAMS: CameraStreamConfig[] = [
  {
    id: 'calibration',
    label: '전면 보정뷰',
    path: '/ws/board_perspective_jpg',
    description: '보드 좌표계를 기준으로 정렬한 전면 보정 스트림입니다.',
    transformClass: 'rotate-180 -scale-x-100',
  },
  {
    id: 'color',
    label: '컬러 카메라',
    path: '/ws/color_jpg',
    description: '실시간 컬러 이미지를 그대로 확인할 수 있는 스트림입니다.',
  },
];

export function RobotCameraPanel({ variant = 'panel' }: RobotCameraPanelProps) {
  const [activeTab, setActiveTab] = useState<CameraTab>('calibration');
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [status, setStatus] = useState<ConnectionState>('connecting');
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const activeStream = useMemo(
    () => CAMERA_STREAMS.find((stream) => stream.id === activeTab) ?? CAMERA_STREAMS[0],
    [activeTab]
  );

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

    const scheduleReconnect = () => {
      if (isUnmounted) {
        return;
      }
      setStatus('closed');
      clearReconnectTimer();
      reconnectTimer = window.setTimeout(connect, RECONNECT_INTERVAL_MS);
    };

    const connect = () => {
      if (isUnmounted) {
        return;
      }

      clearReconnectTimer();
      setStatus('connecting');
      setImageSrc(null);

      ws = new WebSocket(`${STREAM_WS_BASE}${activeStream.path}`);

      ws.onopen = () => {
        if (isUnmounted) {
          ws?.close();
          return;
        }
        setStatus('open');
      };

      ws.onerror = () => {
        scheduleReconnect();
      };

      ws.onclose = () => {
        scheduleReconnect();
      };

      ws.onmessage = (event) => {
        if (isUnmounted) {
          return;
        }
        if (event.data instanceof Blob) {
          const reader = new FileReader();
          reader.onload = (loadEvent) => {
            if (isUnmounted) {
              return;
            }
            const result = loadEvent.target?.result;
            if (typeof result === 'string') {
              setImageSrc(result);
              setLastUpdated(Date.now());
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
  }, [activeStream.path]);

  const statusLabel = status === 'open' ? 'Live' : status === 'connecting' ? 'Connecting' : 'Disconnected';
  const statusClass =
    status === 'open'
      ? 'border-emerald-500/40 text-emerald-200 bg-emerald-500/10'
      : status === 'connecting'
      ? 'border-amber-500/40 text-amber-200 bg-amber-500/10'
      : 'border-red-500/40 text-red-200 bg-red-500/10';

  if (variant === 'overlay') {
    return (
      <div className="pointer-events-auto w-[280px] rounded-2xl border border-neutral-800/80 bg-neutral-950/80 backdrop-blur-sm text-neutral-100 shadow-xl shadow-black/30">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold tracking-tight text-neutral-50">카메라 뷰</h3>
            <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.28em] font-semibold px-2 py-0.5 rounded-full border ${statusClass}`}>
              {statusLabel}
            </span>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-neutral-400">전면 보정뷰와 컬러 이미지를 빠르게 확인할 수 있는 미니 스트림입니다.</p>
          <div className="mt-3 flex gap-1">
            {CAMERA_STREAMS.map((stream) => {
              const isActive = stream.id === activeTab;
              return (
                <button
                  key={stream.id}
                  type="button"
                  onClick={() => setActiveTab(stream.id)}
                  className={`flex-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    isActive
                      ? 'bg-neutral-100 text-neutral-900 shadow-inner'
                      : 'border border-neutral-700 text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {stream.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="relative mx-4 overflow-hidden rounded-xl border border-neutral-900/60 bg-neutral-900/80">
          <div className="relative aspect-video w-full flex items-center justify-center">
            {imageSrc ? (
              <img
                src={imageSrc}
                alt={activeStream.label}
                className={`h-full w-full object-contain ${activeStream.transformClass ?? ''}`}
              />
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-6 text-[11px] text-neutral-400">
                <div className="flex gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-neutral-500 animate-ping"></div>
                  <div className="h-2 w-2 rounded-full bg-neutral-500 animate-ping" style={{ animationDelay: '0.15s' }}></div>
                  <div className="h-2 w-2 rounded-full bg-neutral-500 animate-ping" style={{ animationDelay: '0.3s' }}></div>
                </div>
                <span>
                  {status === 'connecting'
                    ? '스트림에 연결 중입니다...'
                    : status === 'open'
                    ? '이미지를 수신하는 중입니다...'
                    : '스트림을 수신할 수 없습니다.'}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-3 text-[10px] text-neutral-500">
          <span className="truncate">
            {STREAM_WS_BASE}
            {activeStream.path}
          </span>
          <span>
            {lastUpdated
              ? `업데이트 ${new Date(lastUpdated).toLocaleTimeString()}`
              : '대기 중'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-neutral-900 text-neutral-100 flex flex-col">
      <header className="px-6 pt-6 pb-4 border-b border-neutral-800">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">카메라 스트림</h2>
            <p className="text-sm text-neutral-400 mt-1">
              전면 보정 뷰와 일반 컬러 카메라를 탭으로 전환하며 확인할 수 있습니다.
            </p>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          {CAMERA_STREAMS.map((stream) => {
            const isActive = stream.id === activeTab;
            return (
              <button
                key={stream.id}
                type="button"
                onClick={() => setActiveTab(stream.id)}
                className={`px-4 py-2 text-sm font-semibold rounded-full border transition-colors duration-150 ${
                  isActive
                    ? 'bg-neutral-100 text-neutral-900 border-neutral-100 shadow-inner'
                    : 'border-neutral-700 text-neutral-400 hover:text-neutral-200 hover:border-neutral-500'
                }`}
              >
                {stream.label}
              </button>
            );
          })}
        </div>
      </header>

      <section className="flex-1 overflow-hidden px-6 py-6">
        <div className="bg-neutral-900/70 border border-neutral-800 rounded-2xl shadow-lg shadow-black/10 h-full flex flex-col">
          <header className="px-5 py-3 flex items-center justify-between bg-neutral-900/90 border-b border-neutral-800/80">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-neutral-100">{activeStream.label}</span>
                <span className={`inline-flex items-center gap-1 text-xs uppercase tracking-widest font-semibold px-2 py-0.5 rounded-full border ${statusClass}`}>
                  {statusLabel}
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-1 leading-relaxed">{activeStream.description}</p>
            </div>
            <span className="text-xs text-neutral-600">
              {STREAM_WS_BASE}
              {activeStream.path}
            </span>
          </header>

          <div className="flex-1 bg-neutral-950/60 flex items-center justify-center p-4">
            {imageSrc ? (
              <img
                src={imageSrc}
                alt={activeStream.label}
                className={`max-h-full max-w-full object-contain rounded-lg ${activeStream.transformClass ?? ''}`}
              />
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 py-10 text-neutral-400 text-sm">
                <div className="flex gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-neutral-500 animate-ping"></div>
                  <div
                    className="w-2.5 h-2.5 rounded-full bg-neutral-500 animate-ping"
                    style={{ animationDelay: '0.15s' }}
                  ></div>
                  <div
                    className="w-2.5 h-2.5 rounded-full bg-neutral-500 animate-ping"
                    style={{ animationDelay: '0.3s' }}
                  ></div>
                </div>
                <span>
                  {status === 'connecting'
                    ? '스트림에 연결 중입니다...'
                    : status === 'open'
                    ? '이미지를 수신하는 중입니다...'
                    : '스트림을 수신할 수 없습니다. 잠시 후 다시 시도해 주세요.'}
                </span>
              </div>
            )}
          </div>

          <footer className="px-5 py-3 border-t border-neutral-800/80 text-xs text-neutral-500 flex items-center justify-between">
            <span>연결 상태에 따라 스트림이 자동으로 재연결됩니다.</span>
            <span>
              {lastUpdated
                ? `마지막 업데이트: ${new Date(lastUpdated).toLocaleTimeString()}`
                : '아직 프레임이 수신되지 않았습니다.'}
            </span>
          </footer>
        </div>
      </section>
    </div>
  );
}


