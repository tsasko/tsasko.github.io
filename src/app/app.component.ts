import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { DropzoneComponent } from './dropzone/dropzone.component';
import { SldComponent } from './sld/sld.component';
import { PropertiesPanelComponent } from './properties/properties-panel.component';
import { TopologyGraph, TopologyNode, SldLayout } from './topology/topology.model';
import { ParseError, parseTopology } from './topology/topology.parser';
import { computeLayout } from './topology/sld-layout';

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DropzoneComponent, SldComponent, PropertiesPanelComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  // ── State ───────────────────────────────────────────────────────────────────
  file = signal<File | null>(null);
  topology = signal<TopologyGraph | null>(null);
  layout = signal<SldLayout | null>(null);
  selectedNode = signal<TopologyNode | null>(null);
  parseError = signal<string | null>(null);
  isLoading = signal(false);

  // ── File handling ───────────────────────────────────────────────────────────
  onFilePicked(file: File): void {
    this.isLoading.set(true);
    this.parseError.set(null);
    this.selectedNode.set(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const raw = JSON.parse(e.target!.result as string);
        const graph = parseTopology(raw);
        const sldLayout = computeLayout(graph);
        this.file.set(file);
        this.topology.set(graph);
        this.layout.set(sldLayout);
      } catch (err) {
        this.parseError.set(
          err instanceof ParseError
            ? err.message
            : 'Failed to parse file. Make sure it is a valid pv-config.json.'
        );
      } finally {
        this.isLoading.set(false);
      }
    };
    reader.onerror = () => {
      this.parseError.set('Could not read the file.');
      this.isLoading.set(false);
    };
    reader.readAsText(file);
  }

  loadDifferent(): void {
    this.file.set(null);
    this.topology.set(null);
    this.layout.set(null);
    this.selectedNode.set(null);
    this.parseError.set(null);
  }

  onNodeSelected(node: TopologyNode): void {
    this.selectedNode.set(node);
  }

  get statsSummary(): string {
    const g = this.topology();
    if (!g) return '';
    const s = g.stats;
    const parts: string[] = [
      s.segmentCount ? `${s.segmentCount} seg` : '',
      s.powerTransformerCount ? `${s.powerTransformerCount} PT` : '',
      s.inverterTransformerCount ? `${s.inverterTransformerCount} IT` : '',
      s.inverterCount ? `${s.inverterCount} inv` : '',
      s.arrayCount ? `${s.arrayCount} arr` : '',
      s.moduleName ?? '',
    ].filter(Boolean);
    return parts.join('  ·  ');
  }
}
