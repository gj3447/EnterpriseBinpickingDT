export type VariantTypeName = "Double" | "Int32" | "Boolean" | "String";

export interface OpcWritableNodeMeta {
  nodeId: string;
  variantType: VariantTypeName;
  isArray?: boolean;
  arrayLength?: number;
  description?: string;
}

const OPC_WRITABLE_NODE_META_LIST: OpcWritableNodeMeta[] = [
  {
    nodeId: "ns=2;i=52",
    variantType: "Double",
    isArray: true,
    arrayLength: 6,
    description: "Commands.TargetJoints",
  },
  {
    nodeId: "ns=2;i=53",
    variantType: "Double",
    isArray: true,
    arrayLength: 6,
    description: "Commands.TargetTCP",
  },
  {
    nodeId: "ns=2;i=54",
    variantType: "Int32",
    description: "Commands.Mode",
  },
  {
    nodeId: "ns=2;i=55",
    variantType: "Double",
    description: "Commands.JVel",
  },
  {
    nodeId: "ns=2;i=56",
    variantType: "Double",
    description: "Commands.JAcc",
  },
  {
    nodeId: "ns=2;i=57",
    variantType: "Double",
    description: "Commands.LVel",
  },
  {
    nodeId: "ns=2;i=58",
    variantType: "Double",
    description: "Commands.LAcc",
  },
  {
    nodeId: "ns=2;i=59",
    variantType: "Int32",
    description: "Commands.Trigger",
  },
  {
    nodeId: "ns=2;i=60",
    variantType: "Boolean",
    description: "Gripper.Commands.Open",
  },
  {
    nodeId: "ns=2;i=61",
    variantType: "Boolean",
    description: "Gripper.Commands.Close",
  },
];

const OPC_WRITABLE_NODE_META: Record<string, OpcWritableNodeMeta> = OPC_WRITABLE_NODE_META_LIST.reduce(
  (acc, meta) => {
    acc[meta.nodeId] = meta;
    return acc;
  },
  {} as Record<string, OpcWritableNodeMeta>
);

export function getOpcWritableNodeMeta(nodeId: string): OpcWritableNodeMeta | undefined {
  return OPC_WRITABLE_NODE_META[nodeId];
}


