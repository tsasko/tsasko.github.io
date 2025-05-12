import { Scene, MeshBuilder, VertexData, Mesh } from "@babylonjs/core";

interface TerrainOptions {
  width: number;
  depth: number;
  maxHeight: number;
  subdivisions?: number;
}

export class Terrain {
  public mesh: Mesh;
  private opts: TerrainOptions;
  private heights: Float32Array;

  constructor(scene: Scene, opts: TerrainOptions) {
    this.opts = { ...opts, subdivisions: opts.subdivisions ?? 256 };
    const { width, depth, subdivisions } = this.opts;

    const size = (subdivisions + 1) * (subdivisions + 1);
    this.heights = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      this.heights[i] = (Math.random() - 0.5) * this.opts.maxHeight;
    }

    const ground = MeshBuilder.CreateGround("ground", {
      width,
      height: depth,
      subdivisions,
      updatable: false,
    }, scene);

    const vd = VertexData.ExtractFromMesh(ground);
    for (let i = 0; i < vd.positions!.length; i += 3) {
      vd.positions![i + 1] = this.heights[i / 3];
    }
    vd.applyToMesh(ground, true);

    this.mesh = ground;
  }

  getHeightAt(x: number, z: number): number {
    const { width, depth, subdivisions } = this.opts;
    const gridX = Math.floor((x / width) * subdivisions);
    const gridZ = Math.floor((z / depth) * subdivisions);
    const idx = gridZ * (subdivisions + 1) + gridX;
    return this.heights[idx] ?? 0;
  }
}
