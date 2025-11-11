import { NextRequest, NextResponse } from "next/server";

import { browseOpcUaNode } from "@/lib/opcua";

interface BrowseRequestBody {
  nodeId?: unknown;
}

const DEFAULT_ROOT = "RootFolder";

export async function POST(request: NextRequest) {
  let body: BrowseRequestBody;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "잘못된 JSON 요청입니다." }, { status: 400 });
  }

  const nodeId = typeof body.nodeId === "string" && body.nodeId.trim().length > 0 ? body.nodeId : DEFAULT_ROOT;

  try {
    const result = await browseOpcUaNode(nodeId);
    return NextResponse.json({ endpoint: process.env.OPC_UA_ENDPOINT, result });
  } catch (error) {
    return NextResponse.json(
      {
        message: "OPC UA 노드를 Browse하는 데 실패했습니다.",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}


