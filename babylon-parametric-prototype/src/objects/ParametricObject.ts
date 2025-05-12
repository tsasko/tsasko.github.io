import { Mesh, Scene, Vector3, StandardMaterial, Color3 } from "@babylonjs/core";
import { Terrain } from "../terrain";

export abstract class ParametricObject {
  mesh!: Mesh;
  origin: Vector3;
  params: Record<string, number>;
  protected scene: Scene;
  protected terrain: Terrain;

  constructor(scene: Scene, terrain: Terrain, origin = new Vector3(500, 0, 500)) {
    this.scene = scene;
    this.terrain = terrain;
    this.origin = origin.clone();
    this.params = {};
    this.createMesh();
    this.placeOnTerrain();
    this.mesh.metadata = { parametric: this };
  }

  protected abstract createMesh(): void;

  updateMesh() {
    const old = this.mesh;
    this.createMesh();
    old.dispose();
    this.placeOnTerrain();
  }

  placeOnTerrain() {
    const y = this.terrain.getHeightAt(this.origin.x, this.origin.z);
    this.mesh.position.set(this.origin.x, y, this.origin.z);
  }

  setHighlighted(highlight: boolean) {
    const mat = this.mesh.material as StandardMaterial;
    if (!mat) return;
    mat.emissiveColor = highlight ? Color3.Yellow() : Color3.Black();
  }
}
