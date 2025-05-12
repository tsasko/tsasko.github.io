import { MeshBuilder, StandardMaterial, Color3 } from "@babylonjs/core";
import { ParametricObject } from "./ParametricObject";

export class Chimney extends ParametricObject {
  constructor(scene, terrain) {
    super(scene, terrain);
    this.params = { bottom: 4, top: 2, height: 30 };
    this.updateMesh();
  }

  protected createMesh() {
    const { bottom, top, height } = this.params;
    this.mesh = MeshBuilder.CreateCylinder("chimney", {
      height,
      diameterTop: top,
      diameterBottom: bottom,
      tessellation: 32,
    }, this.scene);

    const mat = new StandardMaterial("chimneyMat", this.scene);
    mat.diffuseColor = new Color3(0.5, 0.5, 0.5);
    this.mesh.material = mat;
  }
}
