const DEFAULT_GATEWAY_HOST = "192.168.0.196";
const DEFAULT_GATEWAY_HTTP_PORT = 53000;
const DEFAULT_GATEWAY_HTTP_BASE = `http://${DEFAULT_GATEWAY_HOST}:${DEFAULT_GATEWAY_HTTP_PORT}`;
const DEFAULT_STREAM_WS_BASE = `ws://${DEFAULT_GATEWAY_HOST}:${DEFAULT_GATEWAY_HTTP_PORT}`;
const DEFAULT_MAIN_SERVER_URL = "http://192.168.0.196:8001";
const DEFAULT_RSS_BASE_URL = "http://192.168.0.197:51000";

const numberFromEnv = (value: string | undefined, fallback: number) => {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const ensureLeadingSlash = (value: string) => {
  if (!value) {
    return "/";
  }
  return value.startsWith("/") ? value : `/${value}`;
};

const joinBaseAndPath = (base: string, path: string) => {
  const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  return `${normalizedBase}${ensureLeadingSlash(path)}`;
};

const streamPaths = {
  transforms: ensureLeadingSlash(process.env.NEXT_PUBLIC_STREAM_TRANSFORMS_PATH ?? "/ws/transforms_robot"),
  boardPerspective: ensureLeadingSlash(process.env.NEXT_PUBLIC_STREAM_BOARD_PERSPECTIVE_PATH ?? "/ws/board_perspective_jpg"),
  color: ensureLeadingSlash(process.env.NEXT_PUBLIC_STREAM_COLOR_PATH ?? "/ws/color_jpg"),
  depth: ensureLeadingSlash(process.env.NEXT_PUBLIC_STREAM_DEPTH_PATH ?? "/ws/depth_jpg"),
  arucoDebug: ensureLeadingSlash(process.env.NEXT_PUBLIC_STREAM_ARUCO_DEBUG_PATH ?? "/ws/aruco_debug_jpg"),
} as const;

const streamWsBase = process.env.NEXT_PUBLIC_STREAM_WS_BASE ?? DEFAULT_STREAM_WS_BASE;

const defaultOpcUaEndpoint =
  process.env.NODE_ENV === "production"
    ? "opc.tcp://192.168.0.196:4840/doosan/server/"
    : "opc.tcp://localhost:4840";

const optionalGatewayBase =
  process.env.ROBOT_IK_GATEWAY_BASE ??
  process.env.NEXT_PUBLIC_ROBOT_IK_GATEWAY_BASE ??
  DEFAULT_GATEWAY_HTTP_BASE;

export const appConfig = {
  robotIk: {
    ikEndpoint: process.env.ROBOT_IK_ENDPOINT ?? `${optionalGatewayBase}/api/robot/ik`,
    ikDownwardEndpoint:
      process.env.ROBOT_IK_DOWNWARD_ENDPOINT ?? `${optionalGatewayBase}/api/robot/ik/ikpy/downward`,
    ikpyEndpoint: process.env.ROBOT_IK_IKPY_ENDPOINT ?? `${optionalGatewayBase}/api/robot/ik/ikpy`,
    ikpyDownwardEndpoint:
      process.env.ROBOT_IK_IKPY_DOWNWARD_ENDPOINT ?? `${optionalGatewayBase}/api/robot/ik/ikpy/downward`,
  },
  streams: {
    wsBase: streamWsBase,
    reconnectIntervalMs: numberFromEnv(process.env.NEXT_PUBLIC_STREAM_RECONNECT_MS, 1000),
    paths: streamPaths,
    urls: {
      transforms: joinBaseAndPath(streamWsBase, streamPaths.transforms),
      boardPerspective: joinBaseAndPath(streamWsBase, streamPaths.boardPerspective),
      color: joinBaseAndPath(streamWsBase, streamPaths.color),
      depth: joinBaseAndPath(streamWsBase, streamPaths.depth),
      arucoDebug: joinBaseAndPath(streamWsBase, streamPaths.arucoDebug),
    },
  },
  ycb: {
    mainServerUrl: process.env.NEXT_PUBLIC_MAIN_SERVER_URL ?? DEFAULT_MAIN_SERVER_URL,
    rssBaseUrl: process.env.NEXT_PUBLIC_RSS_BASE ?? DEFAULT_RSS_BASE_URL,
  },
  opcua: {
    endpoint:
      process.env.OPC_UA_ENDPOINT ??
      process.env.NEXT_PUBLIC_OPC_UA_ENDPOINT ??
      defaultOpcUaEndpoint,
  },
} as const;

export type AppConfig = typeof appConfig;

