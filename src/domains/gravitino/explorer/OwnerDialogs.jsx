/**
 * OwnerDialogs — три SetOwnerDialog (catalog/schema/table) в одном
 * месте, используется CatalogExplorer (U6.3 split).
 *
 * Каждый item: { id, owner, onClose, onSubmit }.
 * Вынесено отдельно ради LOC-budget'а в CatalogExplorer.jsx (<300 LOC).
 */
import SetOwnerDialog from "./SetOwnerDialog.jsx";

export default function OwnerDialogs({ users = [], groups = [], items = [] }) {
  return (
    <>
      {items.map((it, i) => (
        <SetOwnerDialog
          key={i}
          visible={!!it.id}
          currentOwner={it.owner}
          users={users} groups={groups}
          onClose={it.onClose}
          onSubmit={it.onSubmit}
        />
      ))}
    </>
  );
}
