import { useParams, Link } from "react-router-dom";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { apiTicketSchema } from "@tms/core";
import {
  priorityVariant,
  statusVariant,
  typeVariant,
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
} from "@/lib/ticket-badges";
import Navbar from "@/components/Navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "";

// ─── Detail row helper ────────────────────────────────────────────────────────

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
      <div className="text-sm">{children}</div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

function TicketDetail() {
  const { id } = useParams<{ id: string }>();

  const { data: ticket, isLoading, isError } = useQuery({
    queryKey: ["ticket", id],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/tickets/${id}`, { withCredentials: true });
      return apiTicketSchema.parse(res.data);
    },
    enabled: !!id,
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Button variant="ghost" size="sm" className="mb-4 -ml-2" asChild>
            <Link to="/tickets">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to Tickets
            </Link>
          </Button>

          {isLoading && (
            <div className="space-y-4">
              <Skeleton className="h-8 w-2/3" />
              <Skeleton className="h-5 w-1/3" />
              <div className="flex gap-2 mt-2">
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-6 w-20" />
              </div>
            </div>
          )}

          {isError && (
            <div className="bg-destructive/10 text-destructive text-sm p-4 rounded-md">
              Failed to load ticket. It may not exist or you may not have access.
            </div>
          )}

          {ticket && (
            <div className="space-y-6">
              {/* Header */}
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="font-mono text-sm text-muted-foreground">{ticket.ticketId}</span>
                  <div className="flex gap-2">
                    <Badge variant={typeVariant(ticket.type)}>{CATEGORY_LABELS[ticket.type]}</Badge>
                    <Badge variant={priorityVariant(ticket.priority)}>{PRIORITY_LABELS[ticket.priority]}</Badge>
                    <Badge variant={statusVariant(ticket.status)}>{STATUS_LABELS[ticket.status]}</Badge>
                  </div>
                </div>
                <h2 className="text-2xl font-bold">{ticket.title}</h2>
              </div>

              {/* Metadata grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 border rounded-lg bg-muted/30">
                <DetailRow label="Project">{ticket.project}</DetailRow>
                <DetailRow label="Created by">{ticket.createdBy.name}</DetailRow>
                <DetailRow label="Assigned to">
                  {ticket.assignedTo ? ticket.assignedTo.name : <span className="text-muted-foreground">Unassigned</span>}
                </DetailRow>
                <DetailRow label="Created">
                  {new Date(ticket.createdAt).toLocaleDateString(undefined, {
                    year: "numeric", month: "short", day: "numeric",
                  })}
                </DetailRow>
              </div>

              {/* Description */}
              <div>
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2">Description</h3>
                <div className="border rounded-lg p-4 bg-muted/20">
                  <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">{ticket.description}</pre>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default TicketDetail;
