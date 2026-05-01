/**
 * ComplianceHub — canvas для compliance_hub projection (U2.6).
 * Группирует metadata-governance (Tags / Policies) под одной точкой входа.
 */
import HubGrid from "./HubGrid.jsx";

const TILES = [
  { projectionId: "tag_list",    label: "Tags",     description: "Метки на metadata-объекты", icon: "🏷" },
  { projectionId: "policy_list", label: "Policies", description: "Data masking, retention",    icon: "📜" },
];

export default function ComplianceHub() {
  return <HubGrid title="Data Compliance" subtitle="Tags и policies" tiles={TILES} />;
}
