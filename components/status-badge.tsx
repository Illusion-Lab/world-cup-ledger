import { Badge } from "@/components/ui/badge";
import { statusLabels, type MarketStatus } from "@/types/domain";

export function StatusBadge({ status }: { status: MarketStatus }) {
  if (status === "won" || status === "half_won") {
    return <Badge variant="success">{statusLabels[status]}</Badge>;
  }
  if (status === "lost" || status === "half_lost") {
    return <Badge variant="destructive">{statusLabels[status]}</Badge>;
  }
  if (status === "pending") {
    return <Badge variant="warning">{statusLabels[status]}</Badge>;
  }
  return <Badge variant="secondary">{statusLabels[status]}</Badge>;
}
