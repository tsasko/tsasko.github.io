import { Engine, Scene, Vector3, ArcRotateCamera, HemisphericLight, Color3 } from "@babylonjs/core";
import "@babylonjs/inspector";

import { Terrain } from "./terrain";
import { Container } from "./objects/Container";
import { Chimney } from "./objects/Chimney";
import { WindTurbine } from "./objects/WindTurbine";
import { buildUI } from "./ui/ui";
import { ParametricObject } from "./objects/ParametricObject";

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
const engine = new Engine(canvas, true);
const scene = new Scene(engine);

// Camera
const camera = new ArcRotateCamera("camera", Math.PI / 4, 1, 1500, new Vector3(500, 0, 500), scene);
camera.attachControl(canvas, true);

// Lights
new HemisphericLight("hLight", new Vector3(0, 1, 0), scene);
scene.clearColor = new Color3(0.8, 0.9, 1);

// Terrain
const terrain = new Terrain(scene, { width: 1000, depth: 1000, maxHeight: 60 });

// Expose for debug
(window as any).scene = scene;
(window as any).terrain = terrain;

// State
let selected: ParametricObject | null = null;
const objects: ParametricObject[] = [];

export function select(obj: ParametricObject | null) {
  selected?.setHighlighted(false);
  selected = obj;
  selected?.setHighlighted(true);
  buildUI(selected);
}

export function addObject(kind: string) {
  let obj: ParametricObject;
  switch (kind) {
    case "Container":
      obj = new Container(scene, terrain);
      break;
    case "Chimney":
      obj = new Chimney(scene, terrain);
      break;
    case "WindTurbine":
      obj = new WindTurbine(scene, terrain);
      break;
    default:
      throw new Error("Unknown kind " + kind);
  }
  objects.push(obj);
  select(obj);
}

// initial UI
buildUI(null);

// pick
scene.onPointerObservable.add((pi) => {
  if (pi.pickInfo?.hit && pi.pickInfo.pickedMesh?.metadata?.parametric) {
    select(pi.pickInfo.pickedMesh.metadata.parametric);
  }
});

engine.runRenderLoop(() => scene.render());
window.addEventListener("resize", () => engine.resize());
