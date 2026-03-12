import { EntityKind, RENDERED_KINDS, TopologyGraph, TopologyNode, TopologyStats } from './topology.model';

/** Thrown when the input is not a valid pv-config.json */
export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParseError';
  }
}

const IGNORED_KINDS: ReadonlySet<string> = new Set([
  'system', 'terrain', 'losses', 'cabling',
  'constraintsGroup', 'importsGroup', 'importedFile',
  'restrictedArea', 'restrictedLine', 'referencePoint',
]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawEntity = Record<string, any>;

export function parseTopology(rawJson: unknown): TopologyGraph {
  // ── 1. Validate input structure ─────────────────────────────────────────────
  if (!rawJson || typeof rawJson !== 'object') {
    throw new ParseError('File does not contain a valid JSON object.');
  }

  const root = rawJson as RawEntity;

  // Support both `pvConfig.entities.entities[]` and direct `entities[]` at root
  let entities: RawEntity[] | null = null;
  if (Array.isArray(root['entities'])) {
    entities = root['entities'] as RawEntity[];
  } else if (
    root['pvConfig'] &&
    root['pvConfig']['entities'] &&
    Array.isArray(root['pvConfig']['entities']['entities'])
  ) {
    entities = root['pvConfig']['entities']['entities'] as RawEntity[];
  } else if (
    root['entities'] &&
    Array.isArray(root['entities']['entities'])
  ) {
    entities = root['entities']['entities'] as RawEntity[];
  }

  if (!entities) {
    throw new ParseError(
      'Could not find entities array. Expected pvConfig.entities.entities[] or entities[].'
    );
  }

  // ── 2. Build entity map ─────────────────────────────────────────────────────
  const entityMap = new Map<string, RawEntity>();
  for (const e of entities) {
    if (e['id']) entityMap.set(String(e['id']), e);
  }

  // Resolve segment name for arrays
  const segmentNames = new Map<string, string>();
  for (const e of entities) {
    if (e['kind'] === 'segment') {
      segmentNames.set(String(e['id']), String(e['name'] ?? e['id']));
    }
  }

  // ── 3. Build parent→children map ───────────────────────────────────────────
  const childrenMap = new Map<string | null, RawEntity[]>();
  childrenMap.set(null, []);

  for (const e of entities) {
    const kind = String(e['kind'] ?? '');
    if (IGNORED_KINDS.has(kind)) continue;

    const parentId: string | null = e['parentEntityId']
      ? String(e['parentEntityId'])
      : null;
    if (!childrenMap.has(parentId)) childrenMap.set(parentId, []);
    childrenMap.get(parentId)!.push(e);
  }

  // ── 4. Build TopologyNode tree ─────────────────────────────────────────────
  const allNodes = new Map<string, TopologyNode>();
  let hasUnsupportedPatterns = false;

  function buildNode(raw: RawEntity, parentId: string | null): TopologyNode {
    const id = String(raw['id']);
    const kind = String(raw['kind'] ?? 'unknown') as EntityKind;
    const name = String(raw['name'] ?? id);

    const node: TopologyNode = {
      id,
      kind,
      name,
      parentId,
      children: [],
      raw,
    };

    // Resolve segment name for array nodes
    if (kind === 'array' && raw['siteEntityId']) {
      const segId = String(raw['siteEntityId']);
      node.segmentName = segmentNames.get(segId) ?? segId;
    }

    if (!RENDERED_KINDS.has(kind)) {
      hasUnsupportedPatterns = true;
    }

    // Recursively add children
    const rawChildren = childrenMap.get(id) ?? [];
    for (const child of rawChildren) {
      const childNode = buildNode(child, id);
      node.children.push(childNode);
    }

    allNodes.set(id, node);
    return node;
  }

  // Roots = entities with kind 'gridConnection' (or orphaned rendered kinds)
  const rootEntities = entities.filter(
    (e) => e['kind'] === 'gridConnection' && !e['parentEntityId']
  );

  if (rootEntities.length === 0) {
    throw new ParseError(
      'No gridConnection entity found. This does not appear to be a valid PV system configuration.'
    );
  }

  const roots: TopologyNode[] = rootEntities.map((e) => buildNode(e, null));

  // ── 5. Compute stats ───────────────────────────────────────────────────────
  const stats = computeStats(roots, entities);

  return { roots, allNodes, stats, hasUnsupportedPatterns };
}

function computeStats(roots: TopologyNode[], rawEntities: RawEntity[]): TopologyStats {
  let segmentCount = 0;
  let powerTransformerCount = 0;
  let inverterTransformerCount = 0;
  let inverterCount = 0;
  let arrayCount = 0;
  let moduleName: string | null = null;
  let totalSegmentAreaM2 = 0;

  // Count from raw entities for completeness
  for (const e of rawEntities) {
    const kind = e['kind'];
    if (kind === 'segment') {
      segmentCount++;
      const area = e['area'] ?? e['totalArea'] ?? 0;
      if (typeof area === 'number') totalSegmentAreaM2 += area;
    } else if (kind === 'powerTransformer') {
      powerTransformerCount++;
    } else if (kind === 'inverterTransformer') {
      inverterTransformerCount++;
    } else if (kind === 'inverterSetup') {
      inverterCount++;
    } else if (kind === 'array') {
      arrayCount++;
      // Try to extract module model name
      if (!moduleName) {
        const moduleRef = e['module'] ?? e['moduleModel'] ?? e['pvModule'];
        if (moduleRef && typeof moduleRef === 'object') {
          moduleName = String(moduleRef['model'] ?? moduleRef['name'] ?? '');
        } else if (typeof moduleRef === 'string') {
          moduleName = moduleRef;
        }
        // Also try systemSize for area
        const sysArea = e['systemSize']?.value ?? e['systemSize'];
        if (typeof sysArea === 'number') {
          // systemSize might be area or power, accept if large enough to be area m²
        }
      }
    }
  }

  // Unused parameter suppression
  void roots;

  return {
    segmentCount,
    powerTransformerCount,
    inverterTransformerCount,
    inverterCount,
    arrayCount,
    moduleName: moduleName || null,
    totalSegmentAreaM2,
  };
}
