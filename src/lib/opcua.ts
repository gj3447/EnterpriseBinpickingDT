import type { DataValue, VariantLike, Variant } from "node-opcua";
import {
  AttributeIds,
  BrowseDirection,
  NodeClass,
  OPCUAClient,
  OPCUASession,
  TimestampsToReturn,
} from "node-opcua";

const DEFAULT_ENDPOINT =
  process.env.NODE_ENV === "production"
    ? "opc.tcp://192.168.0.196:4840/doosan/server/"
    : "opc.tcp://localhost:4840";

const OPC_UA_ENDPOINT =
  process.env.OPC_UA_ENDPOINT ??
  process.env.NEXT_PUBLIC_OPC_UA_ENDPOINT ??
  DEFAULT_ENDPOINT;

type SessionCallback<T> = (session: OPCUASession) => Promise<T>;

const SESSION_IDLE_TIMEOUT_MS = 30_000;

let sharedClient: OPCUAClient | null = null;
let sharedSession: OPCUASession | null = null;
let sharedSessionPromise: Promise<OPCUASession> | null = null;
let sharedSessionRefCount = 0;
let sharedSessionIdleTimer: NodeJS.Timeout | null = null;

function clearSharedSessionIdleTimer() {
  if (sharedSessionIdleTimer) {
    clearTimeout(sharedSessionIdleTimer);
    sharedSessionIdleTimer = null;
  }
}

async function disposeSharedSession() {
  clearSharedSessionIdleTimer();

  const sessionToClose = sharedSession;
  const clientToDisconnect = sharedClient;

  sharedSession = null;
  sharedClient = null;
  sharedSessionPromise = null;

  if (sessionToClose) {
    try {
      await sessionToClose.close();
    } catch (error) {
      console.warn('[OPC UA] 공유 세션 종료 실패', error);
    }
  }

  if (clientToDisconnect) {
    try {
      await clientToDisconnect.disconnect();
    } catch (error) {
      console.warn('[OPC UA] 클라이언트 연결 해제 실패', error);
    }
  }
}

function scheduleSharedSessionDisposal() {
  clearSharedSessionIdleTimer();

  if (!sharedSession || sharedSessionRefCount > 0) {
    return;
  }

  sharedSessionIdleTimer = setTimeout(() => {
    void disposeSharedSession();
  }, SESSION_IDLE_TIMEOUT_MS);
}

function shouldResetSharedSession(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message ?? '';
  return /BadSessionIdInvalid|BadSessionClosed|BadSecureChannelIdInvalid|ConnectionAborted|ECONNRESET|Secure channel is closed/i.test(message);
}

async function acquireSharedSession(): Promise<OPCUASession> {
  if (sharedSession) {
    return sharedSession;
  }

  if (!sharedSessionPromise) {
    sharedSessionPromise = (async () => {
      const client = OPCUAClient.create({ endpointMustExist: false });

      try {
        await client.connect(OPC_UA_ENDPOINT);
        const session = await client.createSession();

        sharedClient = client;
        sharedSession = session;

        return session;
      } catch (error) {
        await client.disconnect().catch(() => {
          /* ignore */
        });
        throw error;
      }
    })()
      .catch(async (error) => {
        await disposeSharedSession();
        throw error;
      })
      .finally(() => {
        sharedSessionPromise = null;
      });
  }

  // sharedSessionPromise 는 null이 아님을 보장
  return sharedSessionPromise as Promise<OPCUASession>;
}

async function withSharedSession<T>(callback: SessionCallback<T>): Promise<T> {
  const session = await acquireSharedSession();

  sharedSessionRefCount += 1;
  clearSharedSessionIdleTimer();

  try {
    const result = await callback(session);
    return result;
  } catch (error) {
    if (shouldResetSharedSession(error)) {
      await disposeSharedSession();
    }
    throw error;
  } finally {
    sharedSessionRefCount = Math.max(0, sharedSessionRefCount - 1);
    if (sharedSessionRefCount === 0) {
      scheduleSharedSessionDisposal();
    }
  }
}

async function withSession<T>(callback: SessionCallback<T>): Promise<T> {
  const client = OPCUAClient.create({ endpointMustExist: false });

  try {
    await client.connect(OPC_UA_ENDPOINT);
    const session = await client.createSession();

    try {
      return await callback(session);
    } finally {
      await session.close();
    }
  } finally {
    await client.disconnect();
  }
}

export interface OpcUaReadResult {
  nodeId: string;
  statusCode: string;
  value?: VariantLike | null;
  serverTimestamp?: string;
  sourceTimestamp?: string;
}

function normalizeVariantValue(variant?: Variant): VariantLike | null {
  if (!variant) {
    return null;
  }

  const rawValue = variant.value as unknown;

  if (rawValue == null) {
    return null;
  }

  if (Array.isArray(rawValue)) {
    return rawValue.map((item) => (ArrayBuffer.isView(item) ? Array.from(item as ArrayLike<unknown>) : item)) as VariantLike;
  }

  if (ArrayBuffer.isView(rawValue)) {
    return Array.from(rawValue as ArrayLike<unknown>) as VariantLike;
  }

  return rawValue as VariantLike;
}

export async function readOpcUaNodes(nodeIds: string[]): Promise<OpcUaReadResult[]> {
  return withSharedSession(async (session) => {
    const results: OpcUaReadResult[] = [];

    for (const nodeId of nodeIds) {
      try {
        const dataValue: DataValue = await session.read({
          nodeId,
          attributeId: AttributeIds.Value,
          indexRange: undefined,
          dataEncoding: undefined,
        });

        results.push({
          nodeId,
          statusCode: dataValue.statusCode.name,
          value: normalizeVariantValue(dataValue.value ?? undefined),
          serverTimestamp: dataValue.serverTimestamp?.toISOString(),
          sourceTimestamp: dataValue.sourceTimestamp?.toISOString(),
        });
      } catch (error) {
        results.push({
          nodeId,
          statusCode: error instanceof Error ? error.message : "UnknownError",
          value: null,
        });
      }
    }

    return results;
  });
}

export interface OpcUaBrowseResultReference {
  browseName: string;
  displayName: string;
  nodeId: string;
  nodeClass: string;
  typeDefinition?: string;
}

export interface OpcUaBrowseResult {
  nodeId: string;
  references: OpcUaBrowseResultReference[];
}

export async function browseOpcUaNode(nodeId: string): Promise<OpcUaBrowseResult> {
  return withSession(async (session) => {
    const browseResult = await session.browse({
      nodeId,
      browseDirection: BrowseDirection.Forward,
      includeSubtypes: true,
      nodeClassMask: 0,
      resultMask: 0x3f,
    });

    const references = (browseResult.references ?? []).map((reference) => ({
      browseName: reference.browseName.toString(),
      displayName: reference.displayName.text ?? reference.displayName.locale ?? "",
      nodeId: reference.nodeId.toString(),
      nodeClass: reference.nodeClass?.key ?? "Unknown",
      typeDefinition: reference.typeDefinition?.toString(),
    }));

    return {
      nodeId,
      references,
    };
  });
}

export interface OpcUaWriteRequest {
  nodeId: string;
  value: VariantLike;
}

export interface OpcUaWriteResult {
  nodeId: string;
  statusCode: string;
}

export async function writeOpcUaNodes(requests: OpcUaWriteRequest[]): Promise<OpcUaWriteResult[]> {
  return withSession(async (session) => {
    const statusCodes = await session.write(
      requests.map((request) => ({
        nodeId: request.nodeId,
        attributeId: AttributeIds.Value,
        value: {
          value: request.value,
          statusCode: undefined,
          sourceTimestamp: undefined,
          serverTimestamp: undefined,
        },
      }))
    );

    return statusCodes.map((statusCode, index) => ({
      nodeId: requests[index]?.nodeId ?? "",
      statusCode: statusCode.name,
    }));
  });
}

export interface OpcUaSubscriptionItem {
  nodeId: string;
  samplingInterval?: number;
}

export interface OpcUaMonitoredValue {
  nodeId: string;
  value: VariantLike | null;
  statusCode: string;
  sourceTimestamp?: string;
}

export interface OpcUaTreeNode {
  nodeId: string;
  displayName: string;
  browseName: string;
  nodeClass: string;
  dataType?: string;
  statusCode?: string;
  value?: VariantLike | null;
  children: OpcUaTreeNode[];
}

interface BrowseTreeOptions {
  startNodeId?: string;
  maxDepth?: number;
  maxChildrenPerNode?: number;
}

export async function browseOpcUaTree(options: BrowseTreeOptions = {}): Promise<OpcUaTreeNode> {
  const {
    startNodeId = "RootFolder",
    maxDepth = 3,
    maxChildrenPerNode = 25,
  } = options;

  return withSession(async (session) => {
    const visited = new Set<string>();

    const readNodeMetadata = async (nodeId: string) => {
      const dataValues = await session.read([
        { nodeId, attributeId: AttributeIds.DisplayName },
        { nodeId, attributeId: AttributeIds.BrowseName },
        { nodeId, attributeId: AttributeIds.NodeClass },
      ]);

      const displayNameValue = dataValues[0]?.value?.value;
      const browseNameValue = dataValues[1]?.value?.value;
      const nodeClassValue = dataValues[2]?.value?.value;

      const displayName = typeof displayNameValue?.text === "string"
        ? displayNameValue.text
        : typeof displayNameValue === "string"
        ? displayNameValue
        : "";

      const browseName = typeof browseNameValue?.name === "string"
        ? browseNameValue.name
        : typeof browseNameValue === "string"
        ? browseNameValue
        : "";

      const nodeClass = typeof nodeClassValue === "number" && NodeClass[nodeClassValue]
        ? NodeClass[nodeClassValue]
        : "Unknown";

      return { displayName, browseName, nodeClass };
    };

    const walk = async (nodeId: string, depth: number): Promise<OpcUaTreeNode> => {
      const metadata = await readNodeMetadata(nodeId);

      const node: OpcUaTreeNode = {
        nodeId,
        displayName: metadata.displayName,
        browseName: metadata.browseName,
        nodeClass: metadata.nodeClass,
        children: [],
      };

      if (metadata.nodeClass === "Variable") {
        try {
          const [valueData, dataTypeData] = await session.read([
            { nodeId, attributeId: AttributeIds.Value },
            { nodeId, attributeId: AttributeIds.DataType },
          ]);

          node.statusCode = valueData?.statusCode?.name;
          node.value = normalizeVariantValue(valueData?.value ?? undefined);

          const rawDataType = dataTypeData?.value?.value;
          if (typeof rawDataType === "string") {
            node.dataType = rawDataType;
          } else if (rawDataType && typeof rawDataType === "object" && "toString" in rawDataType) {
            node.dataType = rawDataType.toString();
          }
        } catch (error) {
          node.statusCode = error instanceof Error ? error.message : "UnknownError";
          node.value = null;
        }
      }

      if (depth >= maxDepth) {
        return node;
      }

      visited.add(nodeId);

      const browseResult = await session.browse({
        nodeId,
        browseDirection: BrowseDirection.Forward,
        includeSubtypes: true,
        nodeClassMask: 0,
        resultMask: 0x3f,
      });

      const references = (browseResult.references ?? []).slice(0, maxChildrenPerNode);

      for (const reference of references) {
        const childId = reference.nodeId?.toString();
        if (!childId || visited.has(childId)) {
          continue;
        }

        try {
          const childNode = await walk(childId, depth + 1);
          node.children.push(childNode);
        } catch (error) {
          node.children.push({
            nodeId: childId,
            displayName: reference.displayName?.text ?? reference.displayName?.locale ?? "",
            browseName: reference.browseName?.toString() ?? "",
            nodeClass: reference.nodeClass?.key ?? "Unknown",
            children: [],
          });
        }
      }

      return node;
    };

    return walk(startNodeId, 0);
  });
}

export type OpcUaSubscriptionCallback = (value: OpcUaMonitoredValue) => void;

export async function subscribeOpcUaNodes(
  items: OpcUaSubscriptionItem[],
  callback: OpcUaSubscriptionCallback,
  options: { publishingInterval?: number; maxNotificationsPerPublish?: number } = {}
) {
  return withSession(async (session) => {
    const subscription = await session.createSubscription2({
      requestedPublishingInterval: options.publishingInterval ?? 1000,
      requestedMaxKeepAliveCount: 20,
      requestedLifetimeCount: 60,
      maxNotificationsPerPublish: options.maxNotificationsPerPublish,
      publishingEnabled: true,
      priority: 1,
    });

    const monitoredItems = await Promise.all(
      items.map(async (item) => {
        const monitoredItem = await subscription.monitor(
          {
            nodeId: item.nodeId,
            attributeId: AttributeIds.Value,
          },
          {
            samplingInterval: item.samplingInterval ?? 250,
            discardOldest: true,
            queueSize: 10,
          },
          TimestampsToReturn.Both
        );

        monitoredItem.on("changed", (dataValue: DataValue) => {
          callback({
            nodeId: item.nodeId,
            value: dataValue.value?.value ?? null,
            statusCode: dataValue.statusCode.name,
            sourceTimestamp: dataValue.sourceTimestamp?.toISOString(),
          });
        });

        return monitoredItem;
      })
    );

    return async () => {
      await Promise.all(monitoredItems.map((item) => item.terminate()));
      await subscription.terminate();
    };
  });
}


