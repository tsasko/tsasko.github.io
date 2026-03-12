import {
  EntityKind,
  SldBusbar,
  SldLayout,
  SldNode,
  SldWire,
  TopologyGraph,
  TopologyNode,
} from './topology.model';

// ──────────────────────────────────────────────────────────────────────────────
// Layout constants
// ──────────────────────────────────────────────────────────────────────────────

const BASE_NODE_W = 186;
const BASE_NODE_H = 56;
const BASE_COL_GAP = 24;
const BASE_COL_W = BASE_NODE_W + BASE_COL_GAP;
const PADDING_LEFT = 120;
const PADDING_TOP = 30;
const PADDING_BOTTOM = 60;

/** Row center Y positions for each entity kind */
const ROW_Y: Partial<Record<EntityKind, number>> = {
  gridConnection: 100,
  powerTransformer: 240,
  // busbar is at 380 (derived below)
  inverterTransformer: 430,
  inverterSetup: 570,
  array: 700,
};

const BUSBAR_Y = 380;

/** Maximum columns before we start scaling down */
const SCALE_THRESHOLD = 8;
/** Minimum node width (when many columns) */
const MIN_NODE_W = 100;

// ──────────────────────────────────────────────────────────────────────────────
// Public function
// ──────────────────────────────────────────────────────────────────────────────

export function computeLayout(graph: TopologyGraph): SldLayout {
  const nodes: SldNode[] = [];
  const wires: SldWire[] = [];
  const busbars: SldBusbar[] = [];

  // ── Step 1: Collect column-defining nodes ──────────────────────────────────
  // Primary columns are IT nodes. If none, fall back to IS nodes.
  const itNodes: TopologyNode[] = [];
  const isNodes: TopologyNode[] = [];

  for (const root of graph.roots) {
    collectNodes(root, itNodes, 'inverterTransformer');
    collectNodes(root, isNodes, 'inverterSetup');
  }

  const useIT = itNodes.length > 0;
  const columnNodes = useIT ? itNodes : isNodes;

  if (columnNodes.length === 0) {
    // Nothing renderable
    return { nodes, wires, busbars, totalWidth: 400, totalHeight: 400, padding: 40 };
  }

  // ── Step 2: Compute scale factor ───────────────────────────────────────────
  const colCount = columnNodes.length;
  let scaleFactor = 1;
  if (colCount > SCALE_THRESHOLD) {
    scaleFactor = Math.max(MIN_NODE_W / BASE_NODE_W, SCALE_THRESHOLD / colCount);
  }

  const NODE_W = Math.round(BASE_NODE_W * scaleFactor);
  const NODE_H = Math.round(BASE_NODE_H * scaleFactor);
  const COL_W = Math.round(BASE_COL_W * scaleFactor);

  // ── Step 3: Assign column index to each column node ───────────────────────
  const colIndexMap = new Map<string, number>();
  columnNodes.forEach((n, i) => colIndexMap.set(n.id, i));

  // ── Step 4: Propagate column to child nodes ─────────────────────────────────
  // IS nodes inherit column from their IT parent (or they ARE the column nodes)
  const nodeColMap = new Map<string, number>();
  columnNodes.forEach((n, i) => nodeColMap.set(n.id, i));

  for (const root of graph.roots) {
    propagateColumns(root, nodeColMap, colIndexMap, useIT);
  }

  // ── Step 5: Build SldNode list ─────────────────────────────────────────────
  const nodeIdToSldNode = new Map<string, SldNode>();

  function placedCx(colIndex: number): number {
    return PADDING_LEFT + colIndex * COL_W + NODE_W / 2;
  }

  function placeNode(tNode: TopologyNode, cx: number, cy: number): SldNode {
    const sn: SldNode = { node: tNode, cx, cy, width: NODE_W, height: NODE_H };
    nodes.push(sn);
    nodeIdToSldNode.set(tNode.id, sn);
    return sn;
  }

  // Grid connection: centered over ALL columns
  for (const root of graph.roots) {
    if (root.kind !== 'gridConnection') continue;

    const allCols = Array.from({ length: colCount }, (_, i) => i);
    const gcCx = centerOfCols(allCols, placedCx, NODE_W);
    const gcY = ROW_Y.gridConnection!;
    placeNode(root, gcCx, gcY);

    // Power transformers under this GC
    const pts = root.children.filter((c) => c.kind === 'powerTransformer');
    if (pts.length > 0) {
      for (const pt of pts) {
        // IT columns under this PT
        const ptItNodes: TopologyNode[] = [];
        collectNodes(pt, ptItNodes, 'inverterTransformer');

        const ptCols = ptItNodes.map((it) => nodeColMap.get(it.id) ?? 0);
        const ptCx = centerOfCols(ptCols, placedCx, NODE_W);
        const ptY = ROW_Y.powerTransformer!;
        placeNode(pt, ptCx, ptY);

        // Busbar for this PT
        if (ptCols.length > 0) {
          const busX1 = placedCx(Math.min(...ptCols)) - NODE_W / 2;
          const busX2 = placedCx(Math.max(...ptCols)) + NODE_W / 2;
          const voltage = extractBusbarVoltage(pt);
          busbars.push({
            x1: busX1, x2: busX2, y: BUSBAR_Y,
            label: voltage, ptId: pt.id, kind: 'inverterTransformer',
          });
        }

        // IT nodes under this PT
        for (const it of ptItNodes) {
          const col = nodeColMap.get(it.id) ?? 0;
          placeNode(it, placedCx(col), ROW_Y.inverterTransformer!);

          // IS under this IT
          for (const is of it.children.filter(c => c.kind === 'inverterSetup')) {
            placeNode(is, placedCx(col), ROW_Y.inverterSetup!);

            // Arrays under IS
            for (const arr of is.children.filter(c => c.kind === 'array')) {
              placeNode(arr, placedCx(col), ROW_Y.array!);
            }
          }
        }
      }
    } else {
      // Pattern B: IS nodes directly under GC (no PT/IT)
      const directIS = root.children.filter(c => c.kind === 'inverterSetup');
      for (const is of directIS) {
        const col = nodeColMap.get(is.id) ?? 0;
        placeNode(is, placedCx(col), ROW_Y.inverterSetup!);

        for (const arr of is.children.filter(c => c.kind === 'array')) {
          placeNode(arr, placedCx(col), ROW_Y.array!);
        }
      }
    }
  }

  // ── Step 6: Build wires ────────────────────────────────────────────────────
  for (const sn of nodes) {
    const parentSn = sn.node.parentId ? nodeIdToSldNode.get(sn.node.parentId) : null;
    if (!parentSn) continue;

    const kind = parentSn.node.kind;
    const px = parentSn.cx;
    const py = parentSn.cy + NODE_H / 2;
    const cx = sn.cx;
    const cy = sn.cy - NODE_H / 2;

    if (kind === 'powerTransformer' && sn.node.kind === 'inverterTransformer') {
      // PT → busbar → IT: elbow wire
      wires.push({
        points: `${px},${py} ${px},${BUSBAR_Y} ${cx},${BUSBAR_Y} ${cx},${cy}`,
        kind: 'inverterTransformer',
      });
    } else {
      // Straight wire
      wires.push({
        points: `${px},${py} ${cx},${cy}`,
        kind: sn.node.kind,
      });
    }
  }

  // ── Step 7: Compute total dimensions ──────────────────────────────────────
  const maxX = Math.max(...nodes.map(n => n.cx + n.width / 2));
  const maxY = Math.max(...nodes.map(n => n.cy + n.height / 2));
  const totalWidth = maxX + PADDING_LEFT;
  const totalHeight = maxY + PADDING_BOTTOM;

  return {
    nodes,
    wires,
    busbars,
    totalWidth: Math.max(totalWidth, 600),
    totalHeight: Math.max(totalHeight, 500),
    padding: PADDING_TOP,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function collectNodes(root: TopologyNode, out: TopologyNode[], kind: EntityKind): void {
  if (root.kind === kind) { out.push(root); return; }
  for (const child of root.children) collectNodes(child, out, kind);
}

function propagateColumns(
  node: TopologyNode,
  nodeColMap: Map<string, number>,
  colIndexMap: Map<string, number>,
  useIT: boolean,
): void {
  for (const child of node.children) {
    // Column-defining nodes already in map
    if (!nodeColMap.has(child.id)) {
      // Inherit parent col
      const parentCol = nodeColMap.get(node.id);
      if (parentCol !== undefined) {
        nodeColMap.set(child.id, parentCol);
      }
    }
    propagateColumns(child, nodeColMap, colIndexMap, useIT);
  }
}

function centerOfCols(
  cols: number[],
  placedCx: (col: number) => number,
  nodeW: number,
): number {
  if (cols.length === 0) return PADDING_LEFT + nodeW / 2;
  const minCx = placedCx(Math.min(...cols));
  const maxCx = placedCx(Math.max(...cols));
  return (minCx + maxCx) / 2;
}

function extractBusbarVoltage(pt: TopologyNode): string {
  const raw = pt.raw;
  const v = raw['nominalVoltage'] ?? raw['outputVoltage'] ?? raw['voltage'];
  if (typeof v === 'number') return `${v} kV`;
  if (typeof v === 'string') return v;
  return 'Busbar';
}
