export type EntityKind =
  | 'gridConnection'
  | 'powerTransformer'
  | 'inverterTransformer'
  | 'inverterSetup'
  | 'array'
  | 'segment'
  | 'system'
  | 'terrain'
  | 'losses'
  | 'cabling'
  | 'constraintsGroup'
  | 'importsGroup'
  | 'importedFile'
  | 'restrictedArea'
  | 'restrictedLine'
  | 'referencePoint';

export const RENDERED_KINDS: ReadonlySet<EntityKind> = new Set([
  'gridConnection',
  'powerTransformer',
  'inverterTransformer',
  'inverterSetup',
  'array',
]);

export interface TopologyNode {
  id: string;
  kind: EntityKind;
  name: string;
  parentId: string | null;
  children: TopologyNode[];
  raw: Record<string, unknown>;
  /** Segment name resolved from siteEntityId (for array nodes) */
  segmentName?: string;
}

export interface TopologyGraph {
  roots: TopologyNode[];
  allNodes: Map<string, TopologyNode>;
  stats: TopologyStats;
  /** True if topology contains unsupported patterns */
  hasUnsupportedPatterns: boolean;
}

export interface TopologyStats {
  segmentCount: number;
  powerTransformerCount: number;
  inverterTransformerCount: number;
  inverterCount: number;
  arrayCount: number;
  moduleName: string | null;
  totalSegmentAreaM2: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// Layout types
// ──────────────────────────────────────────────────────────────────────────────

export interface SldNode {
  node: TopologyNode;
  /** Center X in SVG coordinate space */
  cx: number;
  /** Center Y in SVG coordinate space */
  cy: number;
  width: number;
  height: number;
}

export interface SldWire {
  points: string; // SVG polyline points attribute
  kind: EntityKind;
}

export interface SldBusbar {
  x1: number;
  x2: number;
  y: number;
  label: string;
  /** Parent PT node id */
  ptId: string;
  kind: EntityKind;
}

export interface SldLayout {
  nodes: SldNode[];
  wires: SldWire[];
  busbars: SldBusbar[];
  totalWidth: number;
  totalHeight: number;
  /** Viewport padding applied to all sides */
  padding: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// Validation
// ──────────────────────────────────────────────────────────────────────────────

export type ValidationSeverity = 'info' | 'warning' | 'error';

export interface ValidationIssue {
  severity: ValidationSeverity;
  message: string;
}
