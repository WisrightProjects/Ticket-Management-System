import { ListPagination } from "@/components/ListPagination";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Plus, Inbox } from "lucide-react";
import { STATUS_CONFIG, PRIORITY_CONFIG } from "@/lib/status-config";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { ErrorBanner } from "@/components/ErrorBanner";

type InternalTicket = {
  id:        string;
  ticketId:  string;
  title:     string;
  type:      string;
  priority:  string;
  status:    string;
  createdAt: string;
  updatedAt: string;
  assignedTo: { id: string; name: string } | null;
};

interface TicketsResponse {
  data:       InternalTicket[];
  total:      number;
  page:       number;
  pageSize:   number;
  totalPages: number;
}

const STATUS_LABELS: Record<string, string> = {
  UN_ASSIGNED:        "Unassigned",
  OPEN_NOT_STARTED:   "Not Started",
  OPEN_IN_PROGRESS:   "In Progress",
  OPEN_QA:            "QA",
  OPEN_DONE:          "Done",
  WAITING_FOR_CLIENT: "Waiting for Client",
  CLOSED:             "Closed",
  REOPENED:           "Reopened",
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.CLOSED;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
      style={{ background: cfg.bg, color: cfg.text }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cfg.dot }} />
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

const STATUS_TABS = [
  { value: "",                 label: "All"         },
  { value: "UN_ASSIGNED",      label: "Unassigned"  },
  { value: "OPEN_IN_PROGRESS", label: "In Progress" },
  { value: "OPEN_DONE",        label: "Done"        },
  { value: "CLOSED",           label: "Closed"      },
];

export default function InternalTickets() {
  const [statusFilter, setStatusFilter] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery<TicketsResponse>({
    queryKey: ["internal-tickets", statusFilter, page, pageSize],
    queryFn:  () =>
      axios.get("/api/internal/tickets", {
        params: { status: statusFilter || undefined, page, pageSize },
      }).then((r) => r.data),
  });

  return (
    <div className="px-4 sm:px-6 py-6 sm:py-8" style={{ background: "var(--rt-bg)", minHeight: "100vh" }}>
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <PageHeader
          title="My Tickets"
          subtitle="Tickets directly assigned to you"
          actions={
            <Link to="/internal/submit">
              <Button className="gap-2"><Plus className="h-4 w-4" />New Ticket</Button>
            </Link>
          }
        />

        {/* Status tabs */}
        <div className="flex gap-1 mb-4 bg-[var(--rt-surface)] border border-[var(--rt-border)] rounded-xl p-1 w-fit">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => { setStatusFilter(tab.value); setPage(1); }}
              className={[
                "px-4 py-1.5 rounded-lg text-sm font-medium transition-colors",
                statusFilter === tab.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-[var(--rt-surface)] border border-[var(--rt-border)] rounded-xl overflow-x-auto">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : isError ? (
            <div className="p-6">
              <ErrorBanner message="Failed to load tickets." />
            </div>
          ) : data?.data.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No assigned tickets"
              description="Tickets assigned directly to you will appear here."
            />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-28">ID</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Title</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-32">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-24">Priority</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-40">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-32">Assigned to</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-28">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data?.data.map((t) => (
                  <tr key={t.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{t.ticketId}</td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/internal/tickets/${t.ticketId}`}
                        className="font-medium text-foreground hover:text-primary hover:underline underline-offset-2 transition-colors line-clamp-1"
                      >
                        {t.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground capitalize">{t.type.toLowerCase()}</td>
                    <td
                      className="px-4 py-3 text-xs font-medium capitalize"
                      style={{ color: (PRIORITY_CONFIG[t.priority] ?? PRIORITY_CONFIG.LOW).text }}
                    >
                      {t.priority.toLowerCase()}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{t.assignedTo?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(t.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {data && data.total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 mt-4 text-sm text-muted-foreground">
            <span>Page {data.page} of {data.totalPages} ({data.total} tickets)</span>
            <ListPagination page={page} totalPages={data.totalPages} onPageChange={setPage}
              pageSize={pageSize} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
          </div>
        )}
      </div>
    </div>
  );
}
