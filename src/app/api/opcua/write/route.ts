import { NextRequest, NextResponse } from "next/server";

import { writeOpcUaNodes } from "@/lib/opcua";
import { DataType } from "node-opcua";

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

  const requests = Array.isArray(body.requests)
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
    const normalizedRequests = requests.map((request) => {
      const { dataType, value, nodeId } = request;
      if (typeof dataType === "string") {
        const enumValue = DataType[dataType as keyof typeof DataType];
        if (typeof enumValue !== "number") {
          throw new Error(`지원하지 않는 dataType입니다: ${dataType}`);
        }
        return {
          nodeId,
          value: {
            dataType: enumValue,
            value,
          },
        };
      }

      return {
        nodeId,
        value,
      };
    });

    const results = await writeOpcUaNodes(normalizedRequests);
    return NextResponse.json({ endpoint: process.env.OPC_UA_ENDPOINT, results });
  } catch (error) {
    return NextResponse.json(
      {
        message: "OPC UA 값 쓰기에 실패했습니다.",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
