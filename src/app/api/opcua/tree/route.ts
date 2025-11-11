import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

import { browseOpcUaTree } from "@/lib/opcua";

interface TreeRequestBody {
  startNodeId?: unknown;
  maxDepth?: unknown;
  maxChildrenPerNode?: unknown;
}

export async function POST(request: NextRequest) {
  let body: TreeRequestBody;

  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const startNodeId = typeof body.startNodeId === "string" && body.startNodeId.trim().length > 0
    ? body.startNodeId
    : undefined;

  const maxDepth = typeof body.maxDepth === "number" && Number.isFinite(body.maxDepth)
    ? Math.max(0, Math.min(10, Math.floor(body.maxDepth)))
    : undefined;

  const maxChildrenPerNode = typeof body.maxChildrenPerNode === "number" && Number.isFinite(body.maxChildrenPerNode)
    ? Math.max(1, Math.min(100, Math.floor(body.maxChildrenPerNode)))
    : undefined;

  try {
    const tree = await browseOpcUaTree({ startNodeId, maxDepth, maxChildrenPerNode });
    console.info("[OPC UA Tree]", JSON.stringify(tree, null, 2));

    const outputDir = path.join(process.cwd(), "report");
    const outputPath = path.join(outputDir, "opcua_tree_snapshot.json");

    try {
      await fs.mkdir(outputDir, { recursive: true });
      await fs.writeFile(outputPath, JSON.stringify(tree, null, 2), "utf-8");
    } catch (error) {
      console.error("[OPC UA Tree] 파일 저장 실패", error);
      throw new Error("OPC 트리를 파일로 저장하지 못했습니다.");
    }

    return NextResponse.json({
      endpoint: process.env.OPC_UA_ENDPOINT,
      tree,
      savedPath: path.relative(process.cwd(), outputPath),
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: "OPC UA 트리를 가져오지 못했습니다.",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}


