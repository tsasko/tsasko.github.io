import { MeshBuilder, StandardMaterial, Color3, Vector3, TransformNode } from "@babylonjs/core";
import { ParametricObject } from "./ParametricObject";

export class WindTurbine extends ParametricObject {
  constructor(scene, terrain) {
    super(scene, terrain);
    this.params = { towerHeight: 80, towerDiameter: 4, bladeLength: 40, blades: 3 };
    this.updateMesh();
  }

  protected createMesh() {
    const { towerHeight, towerDiameter, bladeLength, blades } = this.params;

    const root = new TransformNode("turbineRoot", this.scene);

    const tower = MeshBuilder.CreateCylinder("tower", {
      height: towerHeight,
      diameter: towerDiameter,
      tessellation: 24,
    }, this.scene);
    tower.position.y = towerHeight / 2;

    const hub = MeshBuilder.CreateSphere("hub", { diameter: towerDiameter * 1.2 }, this.scene);
    hub.position.y = towerHeight;

    for (let i = 0; i < blades; i++) {
      const blade = MeshBuilder.CreateBox(`blade${i}`, { width: bladeLength, height: towerDiameter * 0.3, depth: towerDiameter * 0.1 }, this.scene);
      blade.position.set(bladeLength / 2, 0, 0);
      blade.parent = hub;
      hub.rotate(Vector3.Up(), (2 * Math.PI * i) / blades);
    }

    const mat = new StandardMaterial("turbineMat", this.scene);
    mat.diffuseColor = new Color3(0.9, 0.9, 0.95);
    [tower, hub].forEach((m) => (m.material = mat));
    hub.getChildren().forEach((m: any) => (m.material = mat));

    tower.parent = root;
    hub.parent = root;

    this.mesh = root as any;
  }
}
