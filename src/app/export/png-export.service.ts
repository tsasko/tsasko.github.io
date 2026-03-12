import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class PngExportService {
  export(svgEl: SVGElement, originalFilename: string): void {
    // Compute dimensions
    const bbox = svgEl.getBoundingClientRect();
    const dpr = 2;
    const w = Math.max(bbox.width, 800);
    const h = Math.max(bbox.height, 600);

    // Serialize SVG with explicit width/height so the canvas can size correctly
    const clone = svgEl.cloneNode(true) as SVGElement;
    clone.setAttribute('width', String(w));
    clone.setAttribute('height', String(h));

    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(clone);
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      const ctx = canvas.getContext('2d')!;
      ctx.scale(dpr, dpr);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);

      const ts = new Date()
        .toISOString()
        .replace(/[:.]/g, '-')
        .slice(0, 19);
      const baseName = originalFilename.replace(/\.json$/i, '');
      const link = document.createElement('a');
      link.download = `sld-${baseName}-${ts}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  }
}
