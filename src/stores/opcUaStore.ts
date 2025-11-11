'use client';

import { create } from 'zustand';

const writeOpcUaNodes = async (requests: Array<{ nodeId: string; value: unknown; dataType?: string }>) => {
  const response = await fetch('/api/opcua/write', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requests }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `OPC UA 쓰기 실패 (HTTP ${response.status})`);
  }

  return response.json();
};

const STATUS_NODE_IDS = {
  currentJoints: 'ns=2;i=10',
  currentTcp: 'ns=2;i=11',
  jointTorques: 'ns=2;i=12',
  toolForces: 'ns=2;i=13',
  motionState: 'ns=2;i=14',
  commandStatus: 'ns=2;i=15',
  errorCode: 'ns=2;i=16',
} as const;

const COMMAND_NODE_IDS = {
  mode: 'ns=2;i=52',
  jVel: 'ns=2;i=53',
  jAcc: 'ns=2;i=54',
  lVel: 'ns=2;i=55',
  lAcc: 'ns=2;i=56',
  trigger: 'ns=2;i=57',
  targetJoints: 'ns=2;i=50',
  gripperOpen: 'ns=2;i=58',
  gripperClose: 'ns=2;i=59',
} as const;

const READ_NODE_ID_LIST = [...Object.values(STATUS_NODE_IDS), ...Object.values(COMMAND_NODE_IDS)];
const POLL_INTERVAL_MS = 2000;

const parseNumberArray = (value: unknown): number[] | null => {
  if (Array.isArray(value)) {
    const numbers = value.map((entry) => {
      if (typeof entry === 'number') {
        return entry;
      }
      const coerced = Number(entry);
      return Number.isFinite(coerced) ? coerced : NaN;
    });
    return numbers.every((num) => Number.isFinite(num)) ? numbers : null;
  }

  if (value && typeof value === 'object') {
    const entries = Object.values(value as Record<string, unknown>);
    if (entries.length > 0) {
      return parseNumberArray(entries);
    }
  }

  return null;
};

const parseNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const candidate = parseNumber(entry);
      if (candidate !== null) {
        return candidate;
      }
    }
    return null;
  }
  if (value && typeof value === 'object') {
    if ('value' in (value as Record<string, unknown>)) {
      return parseNumber((value as Record<string, unknown>).value);
    }
    const entries = Object.values(value as Record<string, unknown>);
    for (const entry of entries) {
      const candidate = parseNumber(entry);
      if (candidate !== null) {
        return candidate;
      }
    }
  }
  return null;
};

interface OpcUaStatusSnapshot {
  currentJoints: number[] | null;
  currentTcp: number[] | null;
  jointTorques: number[] | null;
  toolForces: number[] | null;
  motionState: number | null;
  commandStatus: number | null;
  errorCode: number | null;
}

interface OpcUaCommandSnapshot {
  mode: number | null;
  jVel: number | null;
  jAcc: number | null;
  lVel: number | null;
  lAcc: number | null;
  trigger: number | null;
}

interface OpcUaState {
  status: OpcUaStatusSnapshot;
  commands: OpcUaCommandSnapshot;
  lastUpdated: number | null;
  loading: boolean;
  error: string | null;
  fetchStatus: (options?: { silent?: boolean }) => Promise<void>;
  setStatusForTesting: (status: Partial<OpcUaStatusSnapshot & OpcUaCommandSnapshot>) => void;
  startPolling: () => void;
  stopPolling: () => void;
  pushTargetJoints: (degrees: number[], options?: { velocity?: number; acceleration?: number; mode?: number }) => Promise<void>;
  pulseGripper: (action: 'grip' | 'release', durationMs?: number) => Promise<void>;
}

let pollingTimer: ReturnType<typeof setInterval> | null = null;

export const useOpcUaStore = create<OpcUaState>((set, get) => ({
  status: {
    currentJoints: null,
    currentTcp: null,
    jointTorques: null,
    toolForces: null,
    motionState: null,
    commandStatus: null,
    errorCode: null,
  },
  commands: {
    mode: null,
    jVel: null,
    jAcc: null,
    lVel: null,
    lAcc: null,
    trigger: null,
  },
  lastUpdated: null,
  loading: false,
  error: null,
  fetchStatus: async (options) => {
    const alreadyLoading = get().loading;
    const silent = Boolean(options?.silent);

    if (!silent && !alreadyLoading) {
      set({ loading: true, error: null });
    }

    try {
      const response = await fetch('/api/opcua/read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ nodeIds: READ_NODE_ID_LIST }),
      });

      const responseText = await response.text();
      const data = responseText ? JSON.parse(responseText) : null;

      if (!response.ok) {
        const message =
          typeof data?.message === 'string' && data.message.trim().length > 0
            ? data.message
            : responseText && responseText.trim().length > 0
            ? responseText
            : `HTTP ${response.status}`;
        throw new Error(message);
      }

      const results: Array<{
        nodeId: string;
        statusCode: string;
        value: unknown;
      }> = Array.isArray(data?.results)
        ? data.results.filter(
            (item: unknown): item is { nodeId: string; statusCode: string; value: unknown } =>
              Boolean(
                item &&
                  typeof item === 'object' &&
                  typeof (item as { nodeId?: unknown }).nodeId === 'string' &&
                  typeof (item as { statusCode?: unknown }).statusCode === 'string'
              )
          )
        : [];

      const findResult = (nodeId: string) =>
        results.find((item) => item.nodeId === nodeId);

      const failures: string[] = [];

      const currentJoints = (() => {
        const result = findResult(STATUS_NODE_IDS.currentJoints);
        if (result?.statusCode === 'Good') {
          const numbers = parseNumberArray(result.value);
          if (numbers) {
            return numbers;
          }
          failures.push('CurrentJoints: 응답 형식 오류');
          return null;
        }
        if (result) {
          failures.push(`CurrentJoints: ${result.statusCode}`);
        }
        return null;
      })();

      const currentTcp = (() => {
        const result = findResult(STATUS_NODE_IDS.currentTcp);
        if (result?.statusCode === 'Good') {
          const numbers = parseNumberArray(result.value);
          if (numbers) {
            return numbers;
          }
          failures.push('CurrentTCP: 응답 형식 오류');
          return null;
        }
        if (result) {
          failures.push(`CurrentTCP: ${result.statusCode}`);
        }
        return null;
      })();

      const jointTorques = (() => {
        const result = findResult(STATUS_NODE_IDS.jointTorques);
        if (result?.statusCode === 'Good') {
          const numbers = parseNumberArray(result.value);
          if (numbers) {
            return numbers;
          }
          failures.push('JointTorques: 응답 형식 오류');
          return null;
        }
        if (result) {
          failures.push(`JointTorques: ${result.statusCode}`);
        }
        return null;
      })();

      const toolForces = (() => {
        const result = findResult(STATUS_NODE_IDS.toolForces);
        if (result?.statusCode === 'Good') {
          const numbers = parseNumberArray(result.value);
          if (numbers) {
            return numbers;
          }
          failures.push('ToolForces: 응답 형식 오류');
          return null;
        }
        if (result) {
          failures.push(`ToolForces: ${result.statusCode}`);
        }
        return null;
      })();

      const motionState = (() => {
        const result = findResult(STATUS_NODE_IDS.motionState);
        if (result?.statusCode === 'Good') {
          const numberValue = parseNumber(result.value);
          if (numberValue !== null) {
            return numberValue;
          }
          failures.push('MotionState: 응답 형식 오류');
          return null;
        }
        if (result) {
          failures.push(`MotionState: ${result.statusCode}`);
        }
        return null;
      })();

      const commandStatus = (() => {
        const result = findResult(STATUS_NODE_IDS.commandStatus);
        if (result?.statusCode === 'Good') {
          const numberValue = parseNumber(result.value);
          if (numberValue !== null) {
            return numberValue;
          }
          failures.push('CommandStatus: 응답 형식 오류');
          return null;
        }
        if (result) {
          failures.push(`CommandStatus: ${result.statusCode}`);
        }
        return null;
      })();

      const errorCode = (() => {
        const result = findResult(STATUS_NODE_IDS.errorCode);
        if (result?.statusCode === 'Good') {
          const numberValue = parseNumber(result.value);
          if (numberValue !== null) {
            return numberValue;
          }
          failures.push('ErrorCode: 응답 형식 오류');
          return null;
        }
        if (result) {
          failures.push(`ErrorCode: ${result.statusCode}`);
        }
        return null;
      })();

      const mode = (() => {
        const result = findResult(COMMAND_NODE_IDS.mode);
        if (result?.statusCode === 'Good') {
          const numberValue = parseNumber(result.value);
          if (numberValue !== null) {
            return numberValue;
          }
          failures.push('Mode: 응답 형식 오류');
          return null;
        }
        if (result) {
          failures.push(`Mode: ${result.statusCode}`);
        }
        return null;
      })();

      const jVel = (() => {
        const result = findResult(COMMAND_NODE_IDS.jVel);
        if (result?.statusCode === 'Good') {
          const numberValue = parseNumber(result.value);
          if (numberValue !== null) {
            return numberValue;
          }
          failures.push('JVel: 응답 형식 오류');
          return null;
        }
        if (result) {
          failures.push(`JVel: ${result.statusCode}`);
        }
        return null;
      })();

      const jAcc = (() => {
        const result = findResult(COMMAND_NODE_IDS.jAcc);
        if (result?.statusCode === 'Good') {
          const numberValue = parseNumber(result.value);
          if (numberValue !== null) {
            return numberValue;
          }
          failures.push('JAcc: 응답 형식 오류');
          return null;
        }
        if (result) {
          failures.push(`JAcc: ${result.statusCode}`);
        }
        return null;
      })();

      const lVel = (() => {
        const result = findResult(COMMAND_NODE_IDS.lVel);
        if (result?.statusCode === 'Good') {
          const numberValue = parseNumber(result.value);
          if (numberValue !== null) {
            return numberValue;
          }
          failures.push('LVel: 응답 형식 오류');
          return null;
        }
        if (result) {
          failures.push(`LVel: ${result.statusCode}`);
        }
        return null;
      })();

      const lAcc = (() => {
        const result = findResult(COMMAND_NODE_IDS.lAcc);
        if (result?.statusCode === 'Good') {
          const numberValue = parseNumber(result.value);
          if (numberValue !== null) {
            return numberValue;
          }
          failures.push('LAcc: 응답 형식 오류');
          return null;
        }
        if (result) {
          failures.push(`LAcc: ${result.statusCode}`);
        }
        return null;
      })();

      const trigger = (() => {
        const result = findResult(COMMAND_NODE_IDS.trigger);
        if (result?.statusCode === 'Good') {
          const numberValue = parseNumber(result.value);
          if (numberValue !== null) {
            return numberValue;
          }
          failures.push('Trigger: 응답 형식 오류');
          return null;
        }
        if (result) {
          failures.push(`Trigger: ${result.statusCode}`);
        }
        return null;
      })();

      set({
        status: {
          currentJoints,
          currentTcp,
          jointTorques,
          toolForces,
          motionState,
          commandStatus,
          errorCode,
        },
        commands: {
          mode,
          jVel,
          jAcc,
          lVel,
          lAcc,
          trigger,
        },
        lastUpdated: Date.now(),
        error: failures.length > 0 ? failures.join(' | ') : null,
      });
    } catch (error) {
      set({
        status: {
          currentJoints: null,
          currentTcp: null,
          jointTorques: null,
          toolForces: null,
          motionState: null,
          commandStatus: null,
          errorCode: null,
        },
        commands: {
          mode: null,
          jVel: null,
          jAcc: null,
          lVel: null,
          lAcc: null,
          trigger: null,
        },
        error: error instanceof Error ? error.message : 'OPC UA 요청에 실패했습니다.',
      });
    } finally {
      if (!silent) {
        set({ loading: false });
      }
    }
  },
  setStatusForTesting: (status) =>
    set((prev) => ({
      status: {
        currentJoints: status.currentJoints ?? prev.status.currentJoints,
        currentTcp: status.currentTcp ?? prev.status.currentTcp,
        jointTorques: status.jointTorques ?? prev.status.jointTorques,
        toolForces: status.toolForces ?? prev.status.toolForces,
        motionState: status.motionState ?? prev.status.motionState,
        commandStatus: status.commandStatus ?? prev.status.commandStatus,
        errorCode: status.errorCode ?? prev.status.errorCode,
      },
      commands: {
        mode: status.mode ?? prev.commands.mode,
        jVel: status.jVel ?? prev.commands.jVel,
        jAcc: status.jAcc ?? prev.commands.jAcc,
        lVel: status.lVel ?? prev.commands.lVel,
        lAcc: status.lAcc ?? prev.commands.lAcc,
        trigger: status.trigger ?? prev.commands.trigger,
      },
    })),
  startPolling: () => {
    if (pollingTimer) {
      return;
    }

    void get().fetchStatus({ silent: true });

    pollingTimer = setInterval(() => {
      void get().fetchStatus({ silent: true });
    }, POLL_INTERVAL_MS);
  },
  stopPolling: () => {
    if (pollingTimer) {
      clearInterval(pollingTimer);
      pollingTimer = null;
    }
  },
  pushTargetJoints: async (degrees, options) => {
    const velocity = options?.velocity ?? 0;
    const acceleration = options?.acceleration ?? 0;
    const mode = options?.mode ?? 1;

    await writeOpcUaNodes([
      {
        nodeId: COMMAND_NODE_IDS.targetJoints,
        value: degrees,
        dataType: 'Double',
      },
      {
        nodeId: COMMAND_NODE_IDS.mode,
        value: mode,
        dataType: 'Int32',
      },
      {
        nodeId: COMMAND_NODE_IDS.jVel,
        value: velocity,
        dataType: 'Double',
      },
      {
        nodeId: COMMAND_NODE_IDS.jAcc,
        value: acceleration,
        dataType: 'Double',
      },
      {
        nodeId: COMMAND_NODE_IDS.trigger,
        value: 1,
        dataType: 'Int32',
      },
    ]);

    await writeOpcUaNodes([
      {
        nodeId: COMMAND_NODE_IDS.trigger,
        value: 0,
        dataType: 'Int32',
      },
    ]);
  },
  pulseGripper: async (action, durationMs = 200) => {
    const initial =
      action === 'grip'
        ? { open: false, close: true }
        : { open: true, close: false };

    const requestsOn = [
      {
        nodeId: COMMAND_NODE_IDS.gripperOpen,
        value: initial.open,
        dataType: 'Boolean',
      },
      {
        nodeId: COMMAND_NODE_IDS.gripperClose,
        value: initial.close,
        dataType: 'Boolean',
      },
    ];

    const requestsOff = [
      {
        nodeId: COMMAND_NODE_IDS.gripperOpen,
        value: false,
        dataType: 'Boolean',
      },
      {
        nodeId: COMMAND_NODE_IDS.gripperClose,
        value: false,
        dataType: 'Boolean',
      },
    ];

    await writeOpcUaNodes(requestsOn);
    await new Promise((resolve) => setTimeout(resolve, durationMs));
    await writeOpcUaNodes(requestsOff);
  },
}));

if (typeof window !== 'undefined') {
  useOpcUaStore.getState().startPolling();
}

