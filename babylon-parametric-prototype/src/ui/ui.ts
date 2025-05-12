import { ParametricObject } from "../objects/ParametricObject";
import { addObject } from "../main";

export function buildUI(selected: ParametricObject | null) {
  const sidebar = document.getElementById("sidebar")!;
  sidebar.innerHTML = "";

  const addBtn = document.createElement("button");
  addBtn.textContent = "Pridať objekt";
  sidebar.appendChild(addBtn);

  const select = document.createElement("select");
  ["Container", "Chimney", "WindTurbine"].forEach((k) => {
    const opt = document.createElement("option");
    opt.value = k;
    opt.textContent = k;
    select.appendChild(opt);
  });
  sidebar.appendChild(select);

  addBtn.onclick = () => addObject(select.value);

  if (!selected) return;

  Object.entries(selected.params).forEach(([key, value]) => {
    const wrapper = document.createElement("div");
    const label = document.createElement("label");
    label.textContent = key;
    const input = document.createElement("input");
    input.type = "number";
    input.step = "any";
    input.value = value.toString();
    input.oninput = () => {
      selected.params[key] = parseFloat(input.value);
      selected.updateMesh();
    };
    wrapper.appendChild(label);
    wrapper.appendChild(input);
    sidebar.appendChild(wrapper);
  });

  const reset = document.createElement("button");
  reset.textContent = "Reset";
  reset.onclick = () => {
    selected.updateMesh();
  };
  sidebar.appendChild(reset);
}
