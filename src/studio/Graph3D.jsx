import React, { useMemo, useRef, useEffect } from "react";
import ForceGraph3D from "react-force-graph-3d";
import * as THREE from "three";

const COLOR = {
  entity: "#3b82f6",
  intent: "#10b981",
  role: "#a855f7",
  projection: "#eab308",
  collection: "#64748b",
  unresolved: "#f87171",
};

const EDGE_COLOR = {
  "effect-particle": "#10b981",
  "witness-particle": "#10b981",
  "ownership": "#64748b",
  "reference": "#64748b",
  "role-capability": "#a855f7",
  "projection-source": "#eab308",
  "m2m": "#a855f7",
};

function nodeSize(node) {
  if (node.kind === "entity") return 5 + Math.sqrt((node.fields?.length || 1)) * 1.5;
  if (node.kind === "intent") return 4 + Math.sqrt((node.particles?.effects?.length || 1));
  return 4;
}

function makeGeometry(node, size) {
  if (node.kind === "entity") return new THREE.BoxGeometry(size * 1.2, size * 0.6, size * 1.2);
  if (node.kind === "intent") return new THREE.SphereGeometry(size * 0.6, 16, 16);
  if (node.kind === "role") return new THREE.OctahedronGeometry(size * 0.6);
  if (node.kind === "projection") return new THREE.PlaneGeometry(size * 1.2, size * 0.8);
  return new THREE.SphereGeometry(size * 0.5, 8, 8);
}

const PING_COLOR = { added: "#22c55e", changed: "#60a5fa" };

function makePingMesh(size, color) {
  const geom = new THREE.SphereGeometry(size * 2.3, 24, 24);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5 });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.userData.isPing = true;
  const born = Date.now();
  mesh.onBeforeRender = () => {
    const t = (Date.now() - born) / 1000;
    const phase = (t % 1.0);
    mesh.scale.setScalar(1 + phase * 0.8);
    mat.opacity = Math.max(0, 0.55 - phase * 0.55);
  };
  return mesh;
}

function makeSelectionRing(size) {
  const geom = new THREE.TorusGeometry(size * 1.6, size * 0.08, 12, 48);
  const mat = new THREE.MeshBasicMaterial({ color: "#f8fafc", transparent: true, opacity: 0.95 });
  const ring = new THREE.Mesh(geom, mat);
  ring.userData.isSelection = true;
  ring.onBeforeRender = () => {
    ring.rotation.y += 0.02;
    ring.rotation.x += 0.01;
  };
  return ring;
}

function nodeThreeObject(node, warningsByNode) {
  const size = nodeSize(node);
  const mat = new THREE.MeshLambertMaterial({ color: COLOR[node.kind] || "#94a3b8" });
  const mesh = new THREE.Mesh(makeGeometry(node, size), mat);

  const sev = warningsByNode.get(node.id);
  if (sev === "error") {
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(size * 1.4, 16, 16),
      new THREE.MeshBasicMaterial({ color: "#dc2626", transparent: true, opacity: 0.35 })
    );
    mesh.add(glow);
  } else if (sev === "warning") {
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(size * 1.3, 16, 16),
      new THREE.MeshBasicMaterial({ color: "#eab308", transparent: true, opacity: 0.25 })
    );
    mesh.add(glow);
  }

  return mesh;
}

function attachOverlay(node, mesh) {
  if (!node?.__threeObj || !mesh) return;
  node.__threeObj.add(mesh);
}

function removeOverlay(node, predicate) {
  const obj = node?.__threeObj;
  if (!obj) return;
  const toRemove = obj.children.filter(predicate);
  for (const c of toRemove) obj.remove(c);
}

export default function Graph3D({ graph, onNodeClick, pings, selectedId }) {
  const fgRef = useRef();

  const warningsByNode = useMemo(() => {
    const map = new Map();
    for (const w of graph.warnings || []) {
      const id = `intent:${w.intentId}`;
      const cur = map.get(id);
      if (cur === "error") continue;
      map.set(id, w.severity);
    }
    return map;
  }, [graph.warnings]);

  const data = useMemo(() => {
    const nodeIds = new Set(graph.nodes.map((n) => n.id));
    const extraNodes = [];
    for (const e of graph.edges) {
      if (!nodeIds.has(e.target)) {
        extraNodes.push({
          id: e.target,
          kind: e.target.startsWith("collection:") ? "collection" : "unresolved",
          name: e.target,
          _ephemeral: true,
        });
        nodeIds.add(e.target);
      }
    }
    return {
      nodes: [...graph.nodes, ...extraNodes],
      links: graph.edges.map((e) => ({ source: e.source, target: e.target, kind: e.kind, raw: e })),
    };
  }, [graph]);

  useEffect(() => {
    if (!fgRef.current) return;
    const charge = fgRef.current.d3Force("charge");
    if (charge) charge.strength(-60);
  }, []);

  // Ping overlays: add/remove without re-rendering nodes
  useEffect(() => {
    if (!fgRef.current) return;
    const apply = () => {
      const gd = fgRef.current?.graphData?.();
      if (!gd) return;
      for (const n of gd.nodes) {
        removeOverlay(n, (c) => c.userData?.isPing);
      }
      if (!pings || pings.size === 0) return;
      for (const n of gd.nodes) {
        const type = pings.get(n.id);
        if (!type || !n.__threeObj) continue;
        attachOverlay(n, makePingMesh(nodeSize(n), PING_COLOR[type] || "#60a5fa"));
      }
    };
    const t1 = requestAnimationFrame(apply);
    const t2 = setTimeout(apply, 250);
    return () => { cancelAnimationFrame(t1); clearTimeout(t2); };
  }, [pings]);

  // Selection ring: imperative
  useEffect(() => {
    if (!fgRef.current) return;
    const apply = () => {
      const gd = fgRef.current?.graphData?.();
      if (!gd) return;
      for (const n of gd.nodes) {
        removeOverlay(n, (c) => c.userData?.isSelection);
      }
      if (!selectedId) return;
      const n = gd.nodes.find((x) => x.id === selectedId);
      if (!n?.__threeObj) return;
      attachOverlay(n, makeSelectionRing(nodeSize(n)));
    };
    const t1 = requestAnimationFrame(apply);
    return () => cancelAnimationFrame(t1);
  }, [selectedId, data]);

  // Camera fly to selected node
  useEffect(() => {
    if (!fgRef.current || !selectedId) return;
    const node = data.nodes.find((n) => n.id === selectedId);
    if (!node || typeof node.x !== "number") return;
    const id = requestAnimationFrame(() => {
      try {
        const dist = 110;
        const r = Math.hypot(node.x, node.y, node.z) || 1;
        fgRef.current?.cameraPosition?.(
          { x: node.x * (1 + dist / r), y: node.y * (1 + dist / r), z: node.z * (1 + dist / r) },
          node,
          800
        );
      } catch (e) {
        console.warn("[studio] cameraPosition failed", e);
      }
    });
    return () => cancelAnimationFrame(id);
  }, [selectedId]);

  return (
    <ForceGraph3D
      ref={fgRef}
      graphData={data}
      backgroundColor="#0f172a"
      nodeThreeObject={(n) => nodeThreeObject(n, warningsByNode)}
      linkColor={(l) => EDGE_COLOR[l.kind] || "#475569"}
      linkWidth={(l) => (l.kind?.endsWith("-particle") ? 1.2 : 0.8)}
      linkOpacity={0.7}
      onNodeClick={(n) => onNodeClick?.(n)}
      nodeLabel={(n) => `${n.kind}: ${n.name || n.id}`}
    />
  );
}
