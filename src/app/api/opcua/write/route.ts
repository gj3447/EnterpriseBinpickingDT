import { NextRequest, NextResponse } from "next/server";

import type { OpcUaWriteRequest } from "@/lib/opcua";
import { writeOpcUaNodes } from "@/lib/opcua";
import { DataType, VariantArrayType } from "node-opcua";

import { getOpcWritableNodeMeta, VariantTypeName } from "@/lib/opcuaNodeMeta";

interface WriteRequestItem {
  nodeId?: unknown;
  value?: unknown;
  dataType?: unknown;
}

interface WriteRequestBody {
  requests?: unknown;
}

export async function POST(request: NextRequest) {
  let body: WriteRequestBody;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "잘못된 JSON 요청입니다." }, { status: 400 });
  }

  const requests: Array<{ nodeId: string; value: unknown; dataType?: unknown }> = Array.isArray(body.requests)
    ? body.requests
        .map((item): WriteRequestItem | null => (typeof item === "object" && item !== null ? (item as WriteRequestItem) : null))
        .filter((item): item is WriteRequestItem => Boolean(item?.nodeId))
        .map((item) => ({ nodeId: String(item!.nodeId), value: item!.value, dataType: item!.dataType }))
    : [];

  if (requests.length === 0) {
    return NextResponse.json(
      {
        message: "requests 배열에 최소 한 개 이상의 nodeId를 포함해야 합니다.",
      },
      { status: 400 }
    );
  }

  try {
    const normalizedRequests = requests.map(normalizeWriteRequest);
    console.info("[OPC UA Write] normalized requests:", normalizedRequests);
    const results = await writeOpcUaNodes(normalizedRequests);
    return NextResponse.json({ endpoint: process.env.OPC_UA_ENDPOINT, results });
  } catch (error) {
    if (error instanceof OpcUaWriteValidationError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json(
      {
        message: "OPC UA 값 쓰기에 실패했습니다.",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

const SUPPORTED_VARIANT_TYPES: ReadonlyArray<VariantTypeName> = ["Double", "Int32", "Boolean", "String"];

const VARIANT_TYPE_TO_DATATYPE: Record<VariantTypeName, DataType> = {
  Double: DataType.Double,
  Int32: DataType.Int32,
  Boolean: DataType.Boolean,
  String: DataType.String,
};

class OpcUaWriteValidationError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "OpcUaWriteValidationError";
    this.status = status;
  }
}

function normalizeVariantTypeName(value: unknown): VariantTypeName | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim() as VariantTypeName;
  return SUPPORTED_VARIANT_TYPES.includes(normalized) ? normalized : undefined;
}

function coerceNumber(value: unknown, { integer = false }: { integer?: boolean } = {}): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return integer ? Math.trunc(value) : value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return integer ? Math.trunc(parsed) : parsed;
    }
  }
  throw new OpcUaWriteValidationError(integer ? "Int32 노드는 정수 값을 필요로 합니다." : "Double 노드는 숫자 값을 필요로 합니다.");
}

function coerceBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    if (value === 1) {
      return true;
    }
    if (value === 0) {
      return false;
    }
  }
  if (typeof value === "string") {
    const trimmed = value.trim().toLowerCase();
    if (trimmed === "true" || trimmed === "1") {
      return true;
    }
    if (trimmed === "false" || trimmed === "0") {
      return false;
    }
  }
  throw new OpcUaWriteValidationError("Boolean 노드는 true/false 또는 0/1 값이 필요합니다.");
}

function coerceString(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value == null) {
    return "";
  }
  return String(value);
}

function normalizeNumberArray(value: unknown, expectedLength?: number): number[] {
  let source: unknown[] | null = null;
  if (Array.isArray(value)) {
    source = value;
  } else if (ArrayBuffer.isView(value)) {
    source = Array.from(value as ArrayLike<number>);
  }

  if (!source) {
    throw new OpcUaWriteValidationError("Double 배열 노드는 길이 6의 숫자 리스트가 필요합니다.");
  }

  const normalized = source.map((entry) => coerceNumber(entry));
  if (typeof expectedLength === "number" && normalized.length !== expectedLength) {
    throw new OpcUaWriteValidationError(`Double 배열 노드는 길이 ${expectedLength} 이어야 합니다. (현재 ${normalized.length})`);
  }

  return normalized;
}

function buildVariant(
  variantType: VariantTypeName,
  rawValue: unknown,
  meta: ReturnType<typeof getOpcWritableNodeMeta> | undefined
) {
  switch (variantType) {
    case "Double": {
      const isArray = meta?.isArray || Array.isArray(rawValue) || ArrayBuffer.isView(rawValue as ArrayBufferView);
      if (isArray) {
        return {
          dataType: VARIANT_TYPE_TO_DATATYPE.Double,
          arrayType: VariantArrayType.Array,
          value: normalizeNumberArray(rawValue, meta?.arrayLength),
        };
      }
      return {
        dataType: VARIANT_TYPE_TO_DATATYPE.Double,
        value: coerceNumber(rawValue),
      };
    }
    case "Int32":
      return {
        dataType: VARIANT_TYPE_TO_DATATYPE.Int32,
        value: coerceNumber(rawValue, { integer: true }),
      };
    case "Boolean":
      return {
        dataType: VARIANT_TYPE_TO_DATATYPE.Boolean,
        value: coerceBoolean(rawValue),
      };
    case "String":
      return {
        dataType: VARIANT_TYPE_TO_DATATYPE.String,
        value: coerceString(rawValue),
      };
    default:
      throw new OpcUaWriteValidationError(`지원하지 않는 VariantType입니다: ${variantType}`);
  }
}

function normalizeWriteRequest(request: WriteRequestItem & { nodeId: string; value: unknown }): OpcUaWriteRequest {
  const meta = getOpcWritableNodeMeta(request.nodeId);
  const inferredVariantType = meta?.variantType ?? normalizeVariantTypeName(request.dataType);

  if (inferredVariantType) {
    return {
      nodeId: request.nodeId,
      value: buildVariant(inferredVariantType, request.value, meta),
    };
  }

  if (typeof request.dataType === "string") {
    const enumValue = DataType[request.dataType as keyof typeof DataType];
    if (typeof enumValue !== "number") {
      throw new OpcUaWriteValidationError(`지원하지 않는 dataType입니다: ${request.dataType}`);
    }
    return {
      nodeId: request.nodeId,
      value: {
        dataType: enumValue,
        value: request.value,
      },
    };
  }

  return {
    nodeId: request.nodeId,
    value: request.value,
  };
}
