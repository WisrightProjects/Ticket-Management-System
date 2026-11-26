import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { History } from "lucide-react";
import { CUSTOMER_STATUS } from "@/lib/customer-status";
import { PRIORITY_LABELS, CATEGORY_LABELS } from "@/lib/ticket-badges";

type Event = { id: string; field: string; oldValue: string | null; newValue: string | null; createdAt: string; changedBy: { name: string } };
function eventValue(field: string, value: string | null) {
  if (!value) return "none";
  if (field === "dueAt") return new Date(value).toLocaleString();
  const labels: Record<string, string> = field === "status" ? CUSTOMER_STATUS : field === "priority" ? PRIORITY_LABELS : field === "type" ? CATEGORY_LABELS : {};
  return labels[value] ?? value;
}
export function TicketActivity({ ticketId }: { ticketId: string }) {
  const events = useQuery({ queryKey: ["ticket-history", ticketId], queryFn: async () => (await axios.get<Event[]>(`/api/tickets/${ticketId}/history`, { withCredentials: true })).data });
  return <section className="rounded-xl border bg-card p-5"><h3 className="text-sm font-semibold flex gap-2 items-center mb-4"><History size={16} />Activity history</h3>{events.isPending ? <p className="text-xs text-muted-foreground">Loading activity…</p> : events.isError ? <p role="alert" className="text-xs text-destructive">Unable to load activity.</p> : !events.data.length ? <p className="text-xs text-muted-foreground">Changes will appear here as your team works on this ticket.</p> : <ol className="space-y-4">{events.data.map((event) => <li key={event.id} className="border-l-2 border-border pl-4 text-xs"><p><span className="font-medium">{event.changedBy.name}</span> changed {event.field} from <span className="font-medium">{eventValue(event.field, event.oldValue)}</span> to <span className="font-medium">{eventValue(event.field, event.newValue)}</span></p><p className="mt-1 text-muted-foreground">{new Date(event.createdAt).toLocaleString()}</p></li>)}</ol>}</section>;
}
