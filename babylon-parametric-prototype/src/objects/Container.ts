import { MeshBuilder, StandardMaterial, Texture } from "@babylonjs/core";
import { ParametricObject } from "./ParametricObject";

export class Container extends ParametricObject {
  constructor(scene, terrain) {
    super(scene, terrain);
    this.params = { length: 6, width: 2.44, height: 2.59, azimuth: 0 };
    this.updateMesh();
  }

  protected createMesh() {
    const { length, width, height, azimuth } = this.params;
    this.mesh = MeshBuilder.CreateBox("container", { width: length, depth: width, height }, this.scene);
    this.mesh.rotation.y = azimuth * Math.PI / 180;

    const mat = new StandardMaterial("containerMat", this.scene);
    mat.diffuseTexture = new Texture("/assets/textures/container.jpg", this.scene);
    this.mesh.material = mat;
  }
}
