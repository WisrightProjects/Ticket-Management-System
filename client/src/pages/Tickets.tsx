import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import {
  apiTicketsSchema,
  type ApiTicket,
  TICKET_TYPE,
  PRIORITY,
  STATUS,
  type TicketTypeValue,
  type PriorityValue,
  type StatusValue,
} from "@tms/core";
import Navbar from "@/components/Navbar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const API_URL = import.meta.env.VITE_API_URL || "";

// ─── Badge helpers ────────────────────────────────────────────────────────────

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

function priorityVariant(p: ApiTicket["priority"]): BadgeVariant {
  if (p === PRIORITY.CRITICAL) return "destructive";
  if (p === PRIORITY.HIGH)     return "destructive";
  if (p === PRIORITY.MEDIUM)   return "default";
  return "secondary";
}

function statusVariant(s: ApiTicket["status"]): BadgeVariant {
  if (s === STATUS.OPEN)        return "default";
  if (s === STATUS.IN_PROGRESS) return "default";
  if (s === STATUS.RESOLVED)    return "secondary";
  return "outline";
}

function typeVariant(t: ApiTicket["type"]): BadgeVariant {
  if (t === TICKET_TYPE.BUG)     return "destructive";
  if (t === TICKET_TYPE.SUPPORT) return "default";
  return "secondary";
}

const CATEGORY_LABELS: Record<TicketTypeValue, string> = {
  [TICKET_TYPE.BUG]:         "Bug",
  [TICKET_TYPE.REQUIREMENT]: "Requirement",
  [TICKET_TYPE.TASK]:        "Task",
  [TICKET_TYPE.SUPPORT]:     "Support",
};

const PRIORITY_LABELS: Record<PriorityValue, string> = {
  [PRIORITY.LOW]:      "Low",
  [PRIORITY.MEDIUM]:   "Medium",
  [PRIORITY.HIGH]:     "High",
  [PRIORITY.CRITICAL]: "Critical",
};

const STATUS_LABELS: Record<StatusValue, string> = {
  [STATUS.OPEN]:        "Open",
  [STATUS.IN_PROGRESS]: "In Progress",
  [STATUS.RESOLVED]:    "Resolved",
  [STATUS.CLOSED]:      "Closed",
};

// ─── Component ────────────────────────────────────────────────────────────────

function Tickets() {
  const { data: tickets = [], isLoading, isError } = useQuery<ApiTicket[]>({
    queryKey: ["tickets"],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/tickets`, {
        withCredentials: true,
      });
      return apiTicketsSchema.parse(res.data);
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 py-8">
          <div className="mb-6">
            <Skeleton className="h-7 w-40 mb-1" />
            <Skeleton className="h-4 w-56" />
          </div>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  {["ID", "Title", "Category", "Priority", "Status", "Project", "Created"].map((h) => (
                    <TableHead key={h}>{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </main>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 py-8">
          <div className="bg-destructive/10 text-destructive text-sm p-4 rounded-md">
            Failed to load tickets. Please refresh the page.
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">Tickets</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {tickets.length} {tickets.length === 1 ? "ticket" : "tickets"} — newest first
            </p>
          </div>
        </div>

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">ID</TableHead>
                <TableHead>Title</TableHead>
                <TableHead className="w-28">Category</TableHead>
                <TableHead className="w-28">Priority</TableHead>
                <TableHead className="w-32">Status</TableHead>
                <TableHead>Project</TableHead>
                <TableHead className="w-32">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center text-muted-foreground py-12"
                  >
                    No tickets yet. Send an email to the webhook to create one.
                  </TableCell>
                </TableRow>
              ) : (
                tickets.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell className="font-mono text-sm font-medium">
                      {ticket.ticketId}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{ticket.title}</div>
                      {ticket.assignedTo && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Assigned to {ticket.assignedTo.name}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={typeVariant(ticket.type)}>
                        {CATEGORY_LABELS[ticket.type]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={priorityVariant(ticket.priority)}>
                        {PRIORITY_LABELS[ticket.priority]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(ticket.status)}>
                        {STATUS_LABELS[ticket.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{ticket.project}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(ticket.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </main>
    </div>
  );
}

export default Tickets;
