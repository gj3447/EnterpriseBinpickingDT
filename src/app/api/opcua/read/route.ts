import { NextRequest, NextResponse } from "next/server";

import { readOpcUaNodes } from "@/lib/opcua";

interface ReadRequestBody {
  nodeIds?: unknown;
}

export async function POST(request: NextRequest) {
  let body: ReadRequestBody;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "잘못된 JSON 요청입니다." }, { status: 400 });
  }

  const nodeIds = Array.isArray(body.nodeIds)
    ? body.nodeIds.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : [];

  if (nodeIds.length === 0) {
    return NextResponse.json(
      {
        message: "nodeIds 배열에 최소 한 개 이상의 문자열을 포함해야 합니다.",
      },
      { status: 400 }
    );
  }

  try {
    const results = await readOpcUaNodes(nodeIds);
    return NextResponse.json({ endpoint: process.env.OPC_UA_ENDPOINT, results });
  } catch (error) {
    return NextResponse.json(
      {
        message: "OPC UA 값을 읽어오는 데 실패했습니다.",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}


