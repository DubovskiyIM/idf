/**
 * ExplorerDialogs — modal dialogs для CatalogExplorer (extract из CatalogExplorer.jsx
 * чтобы оставаться < 300 LOC после wire ContextNav).
 *
 * Group: CreateCatalogDialog · OwnerDialogs (catalog/schema/table) · LinkVersionDialog
 * · ConfirmDialog (delete catalog).
 *
 * U-backend-exec-2: текущий owner читается прямо из world.{catalogs,schemas,
 * tables} — после exec fold обновляет мир, optimistic-overrides не нужны.
 */
import ConfirmDialog from "./ConfirmDialog.jsx";
import CreateCatalogDialog from "./CreateCatalogDialog.jsx";
import EditTableDialog from "./EditTableDialog.jsx";
import LinkVersionDialog from "./LinkVersionDialog.jsx";
import OwnerDialogs from "./OwnerDialogs.jsx";

export default function ExplorerDialogs({
  world,
  // Create catalog
  creating, onCloseCreate, onSubmitCreate,
  // Owner dialogs (catalog/schema/table)
  ownerDialogTarget, myCatalogsAll,
  onCloseOwnerDialog, onSubmitOwner,
  schemaOwnerDialogTarget, onCloseSchemaOwner, onSubmitSchemaOwner,
  tableOwnerDialogTarget, onCloseTableOwner, onSubmitTableOwner,
  // Link version
  linkingForModel, suggestedVersion, onCloseLinkVersion, onSubmitLinkVersion,
  // Delete confirm
  deleteTarget, onCancelDelete, onConfirmDelete,
  // Edit table (U-edit-table)
  editTableTarget, onCloseEditTable, onSubmitEditTable,
}) {
  return (
    <>
      <CreateCatalogDialog
        visible={creating}
        onClose={onCloseCreate}
        onSubmit={onSubmitCreate}
      />
      <OwnerDialogs users={world.users || []} groups={world.groups || []} items={[
        {
          id: ownerDialogTarget,
          owner: ownerDialogTarget && myCatalogsAll.find(c => c.id === ownerDialogTarget)?.owner,
          onClose: onCloseOwnerDialog,
          onSubmit: onSubmitOwner,
        },
        {
          id: schemaOwnerDialogTarget,
          owner: schemaOwnerDialogTarget && (world.schemas || []).find(s => s.id === schemaOwnerDialogTarget)?.owner,
          onClose: onCloseSchemaOwner,
          onSubmit: onSubmitSchemaOwner,
        },
        {
          id: tableOwnerDialogTarget,
          owner: tableOwnerDialogTarget && (world.tables || []).find(t => t.id === tableOwnerDialogTarget)?.owner,
          onClose: onCloseTableOwner,
          onSubmit: onSubmitTableOwner,
        },
      ]} />
      <LinkVersionDialog
        visible={!!linkingForModel}
        suggestedVersion={suggestedVersion}
        onClose={onCloseLinkVersion}
        onSubmit={onSubmitLinkVersion}
      />
      <ConfirmDialog
        visible={!!deleteTarget}
        entityName={deleteTarget?.name}
        entityKind="catalog"
        onCancel={onCancelDelete}
        onConfirm={onConfirmDelete}
      />
      <EditTableDialog
        visible={!!editTableTarget}
        initial={editTableTarget}
        onClose={onCloseEditTable}
        onSubmit={onSubmitEditTable}
      />
    </>
  );
}
