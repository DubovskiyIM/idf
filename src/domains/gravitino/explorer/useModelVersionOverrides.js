/**
 * useModelVersionOverrides — optimistic UI overrides для model versions
 * (link / unlink / edit aliases) per version (U-detail-polish, C9).
 *
 * Backend exec живёт в U6.5 — здесь только client-side state.
 * Использует Set для unlinkedIds (≪O(1) lookup) и Record для aliasOverrides.
 *
 * Helper applyTo(versions) применяет overrides к плоскому списку:
 *   - filter out unlinked
 *   - merge aliases override (если есть)
 */
import { useState } from "react";

export function useModelVersionOverrides() {
  const [linkedVersions, setLinkedVersions] = useState([]);
  const [unlinkedIds, setUnlinkedIds] = useState(() => new Set());
  const [aliasOverrides, setAliasOverrides] = useState({});

  const link = (entry) =>
    setLinkedVersions(prev => [...prev, entry]);

  const unlink = (versionId) =>
    setUnlinkedIds(prev => { const next = new Set(prev); next.add(versionId); return next; });

  const editAliases = (versionId, aliases) =>
    setAliasOverrides(prev => ({ ...prev, [versionId]: aliases }));

  const applyTo = (versions = []) =>
    [...versions, ...linkedVersions]
      .filter(v => !unlinkedIds.has(v.id))
      .map(v => aliasOverrides[v.id] !== undefined ? { ...v, aliases: aliasOverrides[v.id] } : v);

  return { linkedVersions, unlinkedIds, aliasOverrides, link, unlink, editAliases, applyTo };
}
