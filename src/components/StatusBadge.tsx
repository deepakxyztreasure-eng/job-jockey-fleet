import { Badge } from "@/components/ui/badge";

const map: Record<string, { label: string; cls: string }> = {
  pending:         { label: "Pending",          cls: "bg-muted text-muted-foreground" },
  assigned:        { label: "Assigned",         cls: "bg-accent/15 text-accent" },
  accepted:        { label: "Accepted",         cls: "bg-accent/15 text-accent" },
  in_progress:     { label: "In Progress",      cls: "bg-warning/15 text-warning" },
  completed:       { label: "Completed",        cls: "bg-success/15 text-success" },
  payment_pending: { label: "Payment Pending",  cls: "bg-priority/15 text-priority" },
  closed:          { label: "Closed",           cls: "bg-success/15 text-success" },
};

export function StatusBadge({ status }: { status: string }) {
  const v = map[status] ?? { label: status, cls: "bg-muted text-muted-foreground" };
  return <Badge className={`${v.cls} border-0 font-medium`}>{v.label}</Badge>;
}
