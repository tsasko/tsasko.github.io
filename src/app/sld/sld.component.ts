import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { SlicePipe } from '@angular/common';
import { SldBusbar, SldLayout, SldNode, SldWire, TopologyNode, ValidationIssue } from '../topology/topology.model';
import { PngExportService } from '../export/png-export.service';
import { TopologyGraph } from '../topology/topology.model';

// ──────────────────────────────────────────────────────────────────────────────
// Interfaces
// ──────────────────────────────────────────────────────────────────────────────

interface Layer {
  name: string;
  label: string;
  color: string;
}

const LAYERS: Layer[] = [
  { name: 'UTILITY', label: 'UTILITY', color: '#D97706' },
  { name: 'HV', label: 'HV', color: '#EA580C' },
  { name: 'MV BUSBAR', label: 'MV BUS', color: '#0284C7' },
  { name: 'MV', label: 'MV', color: '#0284C7' },
  { name: 'LV', label: 'LV', color: '#059669' },
  { name: 'DC', label: 'DC', color: '#7C3AED' },
];

const KIND_CONFIG: Record<string, {
  bg: string; stroke: string; tagBg: string; tagFg: string; wire: string;
  tag: string; symbol: string;
}> = {
  gridConnection: {
    bg: '#FFFBEB', stroke: '#B45309', tagBg: '#FEF3C7', tagFg: '#92400E', wire: '#D97706',
    tag: 'PCC', symbol: 'pcc',
  },
  powerTransformer: {
    bg: '#FFF7ED', stroke: '#C2410C', tagBg: '#FFEDD5', tagFg: '#9A3412', wire: '#EA580C',
    tag: 'XFMR', symbol: 'transformer',
  },
  inverterTransformer: {
    bg: '#F0F9FF', stroke: '#0369A1', tagBg: '#E0F2FE', tagFg: '#075985', wire: '#0284C7',
    tag: 'IT', symbol: 'transformer',
  },
  inverterSetup: {
    bg: '#F0FDF4', stroke: '#047857', tagBg: '#DCFCE7', tagFg: '#065F46', wire: '#059669',
    tag: 'INV', symbol: 'inverter',
  },
  array: {
    bg: '#F5F3FF', stroke: '#6D28D9', tagBg: '#EDE9FE', tagFg: '#4C1D95', wire: '#7C3AED',
    tag: 'PV', symbol: 'array',
  },
};

const DEFAULT_KIND = KIND_CONFIG['gridConnection'];

// ──────────────────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-sld',
  standalone: true,
  imports: [SlicePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sld.component.html',
  styleUrl: './sld.component.css',
})
export class SldComponent implements OnChanges {
  @Input() layout!: SldLayout;
  @Input() graph!: TopologyGraph;
  validationMode = signal(false);
  @Input() filename = '';
  @Output() nodeSelected = new EventEmitter<TopologyNode>();

  @ViewChild('svgEl') svgEl!: ElementRef<SVGElement>;
  @ViewChild('canvasWrapper') canvasWrapper!: ElementRef<HTMLDivElement>;

  private readonly exportSvc = inject(PngExportService);

  // ── Reactive state ──────────────────────────────────────────────────────────
  zoom = signal(1);
  pan = signal({ x: 0, y: 0 });
  isPanning = signal(false);
  private _panStart = { x: 0, y: 0 };
  private _panOrigin = { x: 0, y: 0 };

  // ── Public data ─────────────────────────────────────────────────────────────
  layers = LAYERS;
  validationIssues = new Map<string, ValidationIssue[]>();

  readonly transform = computed(
    () => `translate(${this.pan().x}px, ${this.pan().y}px) scale(${this.zoom()})`
  );

  readonly zoomPct = computed(() => Math.round(this.zoom() * 100));

  ngOnChanges(): void {
    if (this.validationMode() && this.graph) {
      this.validationIssues = computeValidationIssues(this.graph);
    } else {
      this.validationIssues = new Map();
    }
  }

  toggleValidation(): void {
    this.validationMode.update(v => !v);
    if (this.graph) {
      this.validationIssues = this.validationMode()
        ? computeValidationIssues(this.graph)
        : new Map();
    }
  }

  // ── Toolbar actions ─────────────────────────────────────────────────────────
  zoomIn(): void { this.zoom.update(z => Math.min(z * 1.2, 5)); }
  zoomOut(): void { this.zoom.update(z => Math.max(z / 1.2, 0.1)); }

  fit(): void {
    const wrapper = this.canvasWrapper?.nativeElement;
    if (!wrapper || !this.layout) return;
    const wW = wrapper.clientWidth - 88; // subtract layer sidebar
    const wH = wrapper.clientHeight;
    const scaleX = wW / this.layout.totalWidth;
    const scaleY = wH / this.layout.totalHeight;
    const newZoom = Math.min(scaleX, scaleY, 1) * 0.9;
    this.zoom.set(newZoom);
    this.pan.set({
      x: (wW - this.layout.totalWidth * newZoom) / 2 + 88,
      y: (wH - this.layout.totalHeight * newZoom) / 2,
    });
  }

  exportPng(): void {
    if (this.svgEl) {
      this.exportSvc.export(this.svgEl.nativeElement, this.filename || 'sld');
    }
  }

  // ── Pan & zoom event handlers ───────────────────────────────────────────────
  onWheel(e: WheelEvent): void {
    e.preventDefault();
    const wrapper = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const mouseX = e.clientX - wrapper.left;
    const mouseY = e.clientY - wrapper.top;

    const delta = e.deltaY > 0 ? 0.85 : 1 / 0.85;
    const newZoom = Math.min(Math.max(this.zoom() * delta, 0.1), 5);
    const ratio = newZoom / this.zoom();

    this.pan.update(p => ({
      x: mouseX - (mouseX - p.x) * ratio,
      y: mouseY - (mouseY - p.y) * ratio,
    }));
    this.zoom.set(newZoom);
  }

  onMouseDown(e: MouseEvent): void {
    if (e.button !== 0) return;
    this.isPanning.set(true);
    this._panStart = { x: e.clientX, y: e.clientY };
    this._panOrigin = { ...this.pan() };
  }

  @HostListener('window:mousemove', ['$event'])
  onMouseMove(e: MouseEvent): void {
    if (!this.isPanning()) return;
    this.pan.set({
      x: this._panOrigin.x + e.clientX - this._panStart.x,
      y: this._panOrigin.y + e.clientY - this._panStart.y,
    });
  }

  @HostListener('window:mouseup')
  onMouseUp(): void {
    this.isPanning.set(false);
  }

  // ── Node helpers ────────────────────────────────────────────────────────────
  kindConfig(kind: string): typeof DEFAULT_KIND {
    return KIND_CONFIG[kind] ?? DEFAULT_KIND;
  }

  nodeSubtitle(sn: SldNode): string {
    return buildSubtitle(sn.node);
  }

  badgesFor(nodeId: string): ValidationIssue[] {
    return this.validationIssues.get(nodeId) ?? [];
  }

  trackById(_: number, item: SldNode | SldWire | SldBusbar): string {
    if ('node' in item) return item.node.id;
    if ('ptId' in item) return item.ptId;
    return (item as SldWire).points;
  }

  selectNode(e: MouseEvent, node: TopologyNode): void {
    e.stopPropagation();
    this.nodeSelected.emit(node);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function buildSubtitle(node: TopologyNode): string {
  const r = node.raw;
  switch (node.kind) {
    case 'gridConnection': {
      const v = r['voltage'] ?? r['nominalVoltage'];
      const f = r['frequency'];
      const ph = r['nAcPhases'];
      const parts = [
        v ? `${v} kV` : null,
        f ? `${f} Hz` : null,
        ph ? `${ph}Ph` : null,
      ].filter(Boolean);
      return parts.join('  ');
    }
    case 'powerTransformer': {
      const model = r['model'] ?? r['type'];
      return model ? String(model) : '';
    }
    case 'inverterTransformer': {
      const pm = r['positionMode'];
      return pm ? `posMode: ${pm}` : '';
    }
    case 'inverterSetup': {
      const paco = r['Paco'] ?? r['paco'];
      const model = r['model'] ?? r['inverterModel'];
      const parts = [
        paco ? `${Math.round(Number(paco) / 1000)} kW` : null,
        model ? String(model) : null,
      ].filter(Boolean);
      return parts.slice(0, 2).join('  ');
    }
    case 'array': {
      return node.segmentName ?? '';
    }
    default:
      return '';
  }
}

function computeValidationIssues(graph: TopologyGraph): Map<string, ValidationIssue[]> {
  const issues = new Map<string, ValidationIssue[]>();

  function add(id: string, issue: ValidationIssue): void {
    if (!issues.has(id)) issues.set(id, []);
    issues.get(id)!.push(issue);
  }

  for (const [, node] of graph.allNodes) {
    if (node.kind === 'inverterSetup') {
      const paco = Number(node.raw['Paco'] ?? node.raw['paco'] ?? 0);
      const arrays = node.children.filter(c => c.kind === 'array');

      if (arrays.length === 0) {
        add(node.id, { severity: 'warning', message: 'No PV array connected.' });
      } else if (paco > 0) {
        const totalDcKw = arrays.reduce((sum, arr) => {
          const s = (arr.raw['systemSize'] as Record<string, unknown>)?.['value'] ?? arr.raw['systemSize'] ?? 0;
          return sum + Number(s);
        }, 0);
        if (totalDcKw / (paco / 1000) > 1.25) {
          add(node.id, { severity: 'info', message: `DC/AC ratio > 1.25 (${(totalDcKw / (paco / 1000)).toFixed(2)})` });
        }
      }
    }

    if (node.kind === 'inverterTransformer') {
      if (node.raw['positionMode'] === 'auto') {
        add(node.id, { severity: 'info', message: 'Position mode is auto.' });
      }
    }

    if (node.kind === 'powerTransformer') {
      const siblings = node.children.filter(c => c.kind === 'inverterTransformer');
      const vacs = siblings.map(s => s.raw['Vac'] ?? s.raw['vac']);
      const unique = new Set(vacs.filter(Boolean).map(String));
      if (unique.size > 1) {
        for (const sibling of siblings) {
          add(sibling.id, { severity: 'warning', message: 'Vac mismatch between IT siblings.' });
        }
      }
    }
  }

  return issues;
}
