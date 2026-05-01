import { registerCanvas } from "@intent-driven/renderer";
import MetaStudioCanvas from "./MetaStudioCanvas.jsx";

export function registerMetaCanvases() {
  registerCanvas("meta_studio", MetaStudioCanvas);
}
