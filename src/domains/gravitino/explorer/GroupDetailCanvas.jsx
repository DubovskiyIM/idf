/**
 * GroupDetailCanvas — canvas-обёртка для GroupDetailPane (U-iam, B13).
 *
 * routeParams.groupId — id или name группы. Резолвим через world.groups,
 * users — целиком из world.users. Membership state хранится оптимистично
 * локально (useState); backend exec через addGroupMember/removeGroupMember
 * (intent particles) — отдельный flow U-iam-b.
 */
import { useState, useEffect } from "react";
import GroupDetailPane from "./GroupDetailPane.jsx";

export default function GroupDetailCanvas({ world = {}, routeParams, ctx }) {
  const params = routeParams ?? ctx?.routeParams ?? {};
  const groupId = params.groupId;
  const baseGroup = (world.groups || []).find(g => g.id === groupId || g.name === groupId);
  const users = world.users || [];

  // Optimistic membership — sync с baseGroup когда groupId меняется.
  const [members, setMembers] = useState(baseGroup?.members || []);
  useEffect(() => { setMembers(baseGroup?.members || []); }, [baseGroup?.id]);

  if (!baseGroup) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--idf-text-muted)" }}>
        Group не найдена (id: {String(groupId)})
      </div>
    );
  }
  return (
    <GroupDetailPane
      group={{ ...baseGroup, members }}
      users={users}
      onAddMember={(name) => setMembers(prev => prev.includes(name) ? prev : [...prev, name])}
      onRemoveMember={(name) => setMembers(prev => prev.filter(n => n !== name))}
    />
  );
}
