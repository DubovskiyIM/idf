/**
 * DeliveryMapCanvas — тонкая обёртка для canvas-архетипа с primitive:"map".
 * Берёт projection.data.layers, передаёт в SDK Map-примитив вместе с ctx
 * (для resolve `source: "world.xxx"` через coerceLayerItems).
 *
 * Используется для order_tracker / active_delivery / dispatcher_map.
 */
import { primitives } from "@intent-driven/renderer";

const { Map } = primitives;

export default function DeliveryMapCanvas({ artifact, ctx }) {
  const projection = artifact?.projection || {};
  const data = projection.data || {};
  const node = {
    layers: data.layers || [],
    center: data.center,
    zoom: data.zoom,
    height: projection.height || 400,
    interactive: data.interactive !== false,
  };
  return <Map node={node} ctx={ctx} />;
}
