import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Output,
  ViewChild,
  signal,
} from '@angular/core';

@Component({
  selector: 'app-dropzone',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="dropzone"
      [class.dragover]="dragover()"
      (dragover)="onDragOver($event)"
      (dragleave)="onDragLeave()"
      (drop)="onDrop($event)"
      (click)="fileInput.click()"
    >
      <div class="dropzone-inner">
        <svg class="dropzone-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round"
            d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z"/>
        </svg>
        <p class="dropzone-title">Drop pv-config.json here</p>
        <p class="dropzone-sub">or click to browse</p>
      </div>
      <input
        #fileInput
        type="file"
        accept=".json"
        style="display:none"
        (change)="onFileChange($event)"
      />
    </div>
  `,
  styles: [`
    .dropzone {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px dashed var(--color-border);
      border-radius: var(--radius);
      background: var(--color-bg-subtle);
      cursor: pointer;
      transition: border-color 0.15s, background 0.15s;
    }
    .dropzone:hover,
    .dropzone.dragover {
      border-color: var(--color-primary);
      background: var(--color-primary-bg);
    }
    .dropzone-inner {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      pointer-events: none;
      user-select: none;
    }
    .dropzone-icon {
      width: 48px;
      height: 48px;
      color: var(--color-text-muted);
    }
    .dropzone:hover .dropzone-icon,
    .dropzone.dragover .dropzone-icon {
      color: var(--color-primary);
    }
    .dropzone-title {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: var(--color-text);
    }
    .dropzone-sub {
      margin: 0;
      font-size: 13px;
      color: var(--color-text-muted);
    }
  `],
})
export class DropzoneComponent {
  @Output() filePicked = new EventEmitter<File>();
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  dragover = signal(false);

  onDragOver(e: DragEvent): void {
    e.preventDefault();
    this.dragover.set(true);
  }

  onDragLeave(): void {
    this.dragover.set(false);
  }

  onDrop(e: DragEvent): void {
    e.preventDefault();
    this.dragover.set(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) this.emit(file);
  }

  onFileChange(e: Event): void {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.emit(file);
    input.value = '';
  }

  private emit(file: File): void {
    if (!file.name.endsWith('.json')) return;
    this.filePicked.emit(file);
  }
}
