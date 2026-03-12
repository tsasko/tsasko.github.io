import { ChangeDetectionStrategy, Component, Input, OnChanges } from '@angular/core';
import { TopologyNode } from '../topology/topology.model';

interface PropRow {
  label: string;
  value: string;
}

const KIND_LABELS: Record<string, string> = {
  gridConnection: 'Grid Connection (PCC)',
  powerTransformer: 'Power Transformer',
  inverterTransformer: 'Inverter Transformer',
  inverterSetup: 'Inverter Setup',
  array: 'PV Array',
};

const PROP_KEYS: Partial<Record<string, Array<[string, string]>>> = {
  gridConnection: [
    ['voltage', 'Voltage'],
    ['frequency', 'Frequency'],
    ['nAcPhases', 'Phases'],
    ['cosPhi', 'cos φ'],
    ['powerLimit', 'Power Limit'],
  ],
  powerTransformer: [
    ['outputVoltageMode', 'Output Voltage Mode'],
    ['model', 'Model'],
    ['type', 'Type'],
    ['losses', 'Losses'],
    ['positionMode', 'Position Mode'],
  ],
  inverterTransformer: [
    ['outputVoltageMode', 'Output Voltage Mode'],
    ['model', 'Model'],
    ['type', 'Type'],
    ['losses', 'Losses'],
    ['positionMode', 'Position Mode'],
  ],
  inverterSetup: [
    ['model', 'Inverter Model'],
    ['Paco', 'Rated Power (kW)'],
    ['Vac', 'AC Voltage'],
    ['Vdco', 'DC Voltage'],
    ['stringsPerInverter', 'Strings / Inverter'],
    ['desiredDcAcRatio', 'DC/AC Ratio'],
  ],
  array: [
    ['templateType', 'Mounting Type'],
    ['tilt', 'Tilt'],
    ['clearanceHeight', 'Clearance Height'],
    ['systemSize', 'System Size'],
    ['spacing', 'GCR'],
  ],
};

@Component({
  selector: 'app-properties-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (node) {
      <aside class="panel">
        <div class="panel-header">
          <span class="panel-kind">{{ kindLabel }}</span>
          <h3 class="panel-name">{{ node.name }}</h3>
          @if (segmentName) {
            <p class="panel-segment">Segment: {{ segmentName }}</p>
          }
        </div>
        <div class="panel-body">
          @for (row of rows; track row.label) {
            <div class="prop-row">
              <span class="prop-label">{{ row.label }}</span>
              <span class="prop-value">{{ row.value }}</span>
            </div>
          }
          @if (rows.length === 0) {
            <p class="panel-empty">No properties to display.</p>
          }
        </div>
      </aside>
    }
  `,
  styles: [`
    .panel {
      width: 280px;
      min-width: 280px;
      height: 100%;
      background: var(--color-bg);
      border-left: 1px solid var(--color-border);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .panel-header {
      padding: 16px;
      border-bottom: 1px solid var(--color-border-subtle);
      background: var(--color-bg-subtle);
    }
    .panel-kind {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--color-text-muted);
    }
    .panel-name {
      margin: 4px 0 0;
      font-size: 14px;
      font-weight: 600;
      color: var(--color-text);
    }
    .panel-segment {
      margin: 4px 0 0;
      font-size: 12px;
      color: var(--color-text-secondary);
    }
    .panel-body {
      flex: 1;
      overflow-y: auto;
      padding: 8px 0;
    }
    .prop-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 8px;
      padding: 8px 16px;
      border-bottom: 1px solid var(--color-border-subtle);
      font-size: 12px;
    }
    .prop-label {
      color: var(--color-text-secondary);
      flex-shrink: 0;
    }
    .prop-value {
      color: var(--color-text);
      font-family: var(--font-mono);
      font-size: 11px;
      text-align: right;
      word-break: break-all;
    }
    .panel-empty {
      padding: 16px;
      font-size: 12px;
      color: var(--color-text-muted);
    }
  `],
})
export class PropertiesPanelComponent implements OnChanges {
  @Input() node: TopologyNode | null = null;

  rows: PropRow[] = [];
  kindLabel = '';
  segmentName = '';

  ngOnChanges(): void {
    if (!this.node) { this.rows = []; return; }

    this.kindLabel = KIND_LABELS[this.node.kind] ?? this.node.kind;
    this.segmentName = this.node.segmentName ?? '';

    const keyDefs = PROP_KEYS[this.node.kind] ?? [];
    this.rows = [];

    for (const [key, label] of keyDefs) {
      const val = this.node.raw[key];
      if (val === undefined || val === null) continue;
      this.rows.push({ label, value: this.format(val) });
    }

    // Append remaining raw keys not yet shown
    const shownKeys = new Set(keyDefs.map(([k]) => k));
    for (const [key, val] of Object.entries(this.node.raw)) {
      if (shownKeys.has(key)) continue;
      if (['id', 'kind', 'name', 'parentEntityId', 'siteEntityId'].includes(key)) continue;
      if (val === null || val === undefined || typeof val === 'object') continue;
      this.rows.push({ label: key, value: this.format(val) });
    }
  }

  private format(val: unknown): string {
    if (typeof val === 'object' && val !== null) {
      const v = (val as Record<string, unknown>)['value'];
      if (v !== undefined) return this.format(v);
      return JSON.stringify(val);
    }
    if (typeof val === 'number') return String(Math.round(val * 100) / 100);
    return String(val);
  }
}
