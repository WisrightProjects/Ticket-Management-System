import { useState } from "react";
import axios from "axios";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  apiTicketSchema,
  STATUS,
  type ApiTicket,
} from "@tms/core";
import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
} from "@/lib/ticket-badges";
import { STATUS_CONFIG, PRIORITY_CONFIG, TYPE_CONFIG } from "@/lib/status-config";
import { ImageOff, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ImageLightbox } from "@/components/ImageLightbox";
import { SectionHeader } from "@/components/SectionHeader";
import { TicketPill } from "@/components/TicketPill";

const API_URL = import.meta.env.VITE_API_URL || "";

// ─── Attachment helpers ───────────────────────────────────────────────────────

const ATTACHMENT_PREFIX_RE = /^d(\d+)_/;

function AttachmentThumb({
  a,
  unavailable,
  onUnavailable,
}: {
  a: { filename: string; mimetype: string; url: string };
  unavailable: boolean;
  onUnavailable: () => void;
}) {
  return (
    <div className="w-20 h-20 rounded-md border overflow-hidden bg-muted/30 flex items-center justify-center">
      {unavailable ? (
        <span className="flex flex-col items-center gap-1 px-1 text-center text-xs text-muted-foreground">
          <ImageOff className="size-4" aria-hidden="true" />
          Image unavailable
        </span>
      ) : a.mimetype.startsWith("image/") ? (
        <img
          src={a.url}
          alt={a.filename}
          className="w-full h-full object-cover group-hover:opacity-80 transition-opacity"
          onError={onUnavailable}
        />
      ) : (
        <span className="text-xs text-muted-foreground text-center px-1 break-all">
          {a.filename.replace(ATTACHMENT_PREFIX_RE, "")}
        </span>
      )}
    </div>
  );
}

function AttachmentRow({
  attachments,
}: {
  attachments: Array<{ id: string; filename: string; mimetype: string; url: string }>;
}) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [unavailableUrls, setUnavailableUrls] = useState<Set<string>>(() => new Set());
  const images = attachments.filter((a) => a.mimetype.startsWith("image/"));

  if (attachments.length === 0) return null;
  return (
    <>
      <div className="flex flex-wrap gap-3 mt-3">
        {attachments.map((a) => {
          const imgIdx = images.findIndex((img) => img.id === a.id);
          const unavailable = unavailableUrls.has(a.url);
          return (
            <button
              key={a.id}
              type="button"
              disabled={unavailable}
              onClick={() => imgIdx >= 0 ? setLightboxIndex(imgIdx) : window.open(a.url, "_blank", "noopener,noreferrer")}
              className="group flex cursor-pointer flex-col items-center gap-1 disabled:cursor-default"
              aria-label={unavailable ? `${a.filename}: image unavailable` : undefined}
              title={a.filename}
            >
              <AttachmentThumb a={a} unavailable={unavailable} onUnavailable={() =>
                setUnavailableUrls((urls) => new Set(urls).add(a.url))} />
              <span className="text-xs text-muted-foreground max-w-[80px] truncate">
                {a.filename.replace(ATTACHMENT_PREFIX_RE, "")}
              </span>
            </button>
          );
        })}
      </div>
      {lightboxIndex !== null && (
        <ImageLightbox
          images={images.map((a) => ({ url: a.url, filename: a.filename.replace(ATTACHMENT_PREFIX_RE, "") }))}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  );
}

// ─── Description body ─────────────────────────────────────────────────────────

function DescriptionBody({
  description,
  attachments,
}: {
  description: string;
  attachments: Array<{ id: string; filename: string; mimetype: string; url: string; createdAt: string; size: number }>;
}) {
  const sections = description.split("\n\n---\n\n");
  const generalAttachments = attachments.filter((a) => !ATTACHMENT_PREFIX_RE.test(a.filename));

  if (sections.length === 1) {
    const sectionAttachments = attachments.filter((a) => {
      const m = a.filename.match(ATTACHMENT_PREFIX_RE);
      return m ? Number(m[1]) === 0 : false;
    });
    return (
      <>
        <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">{description}</pre>
        <AttachmentRow attachments={[...sectionAttachments, ...generalAttachments]} />
      </>
    );
  }

  return (
    <div className="space-y-4">
      {sections.map((section, idx) => {
        const sectionAttachments = attachments.filter((a) => {
          const m = a.filename.match(ATTACHMENT_PREFIX_RE);
          return m ? Number(m[1]) === idx : false;
        });
        return (
          <div key={idx}>
            {idx > 0 && (
              <>
                <hr className="mb-3 border-border" />
                <SectionHeader title={`Description ${idx + 1}`} className="mb-2" />
              </>
            )}
            <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">{section}</pre>
            <AttachmentRow attachments={sectionAttachments} />
          </div>
        );
      })}
      {generalAttachments.length > 0 && (
        <div>
          <hr className="mb-3 border-border" />
          <SectionHeader title="Attachments" className="mb-2" />
          <AttachmentRow attachments={generalAttachments} />
        </div>
      )}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface TicketDetailProps {
  /** Human-readable ticket ID, e.g. "TKT-0001" */
  ticketId: string;
  readOnly?: boolean;
  embedded?: boolean;
}

export function TicketIdentity({ ticket, pageHeading = false }: { ticket: ApiTicket; pageHeading?: boolean }) {
  const Heading = pageHeading ? "h1" : "h2";
  return (
    <div className="min-w-0 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs font-semibold text-primary">{ticket.ticketId}</span>
        <TicketPill label={STATUS_LABELS[ticket.status]} cfg={STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG.CLOSED} />
        <TicketPill label={PRIORITY_LABELS[ticket.priority]} cfg={PRIORITY_CONFIG[ticket.priority] ?? PRIORITY_CONFIG.LOW} />
        <TicketPill label={CATEGORY_LABELS[ticket.type]} cfg={TYPE_CONFIG[ticket.type] ?? TYPE_CONFIG.TASK} />
      </div>
      <Heading className="break-words text-xl font-semibold tracking-tight sm:text-2xl">{ticket.title}</Heading>
      {pageHeading && <p className="break-words text-sm text-muted-foreground">
        {ticket.senderName || ticket.senderEmail || ticket.createdBy.name}
        {" · "}
        {new Date(ticket.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
      </p>}
    </div>
  );
}

/**
 * Displays a ticket's header (id, badges, title), description section,
 * and customer rating section. Metadata editing lives in TicketMetaSidebar.
 */
function TicketDetail({ ticketId, readOnly = false, embedded = false }: TicketDetailProps) {
  const [summary, setSummary] = useState<string | null>(null);

  const summarizeMutation = useMutation({
    mutationFn: () =>
      axios.post<{ summary: string }>(
        `${API_URL}/api/tickets/${ticketId}/summarize`,
        {},
        { withCredentials: true },
      ),
    onSuccess: (res) => setSummary(res.data.summary),
  });

  const { data: ticket, isLoading, isError } = useQuery({
    queryKey: ["ticket", ticketId],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/tickets/${ticketId}`, { withCredentials: true });
      return apiTicketSchema.parse(res.data);
    },
    enabled: !!ticketId,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-5 w-1/3" />
        <div className="flex gap-2 mt-2">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-6 w-20" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-destructive/10 text-destructive text-sm p-4 rounded-md">
        Failed to load ticket. It may not exist or you may not have access.
      </div>
    );
  }

  if (!ticket) return null;

  return (
    <div className="space-y-6">
      {!embedded && <TicketIdentity ticket={ticket} />}

      {/* Description / message body */}
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Description</h3>
          <Button
            size="sm"
            variant="outline"
            onClick={() => summarizeMutation.mutate()}
            disabled={readOnly || summarizeMutation.isPending}
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            {summarizeMutation.isPending ? "Summarizing…" : "Summarize"}
          </Button>
        </div>
        <div className={embedded ? "break-words text-sm leading-relaxed" : "rounded-lg border bg-muted/20 p-4 break-words"}>
          <DescriptionBody description={ticket.description} attachments={ticket.attachments} />
        </div>
        {summarizeMutation.isError && (
          <p className="text-xs text-destructive mt-2">Failed to summarize. Please try again.</p>
        )}
        {summary && !summarizeMutation.isPending && (
          <div className="mt-3 rounded-lg border bg-muted/30 p-4">
            <SectionHeader title="AI Summary" className="mb-2" />
            <p className="text-sm whitespace-pre-wrap">{summary}</p>
          </div>
        )}
      </div>

      {/* Customer rating — only shown on closed tickets that have a rating */}
      {ticket.status === STATUS.CLOSED && ticket.rating != null && (
        <div className="border rounded-lg p-4 bg-muted/20">
          <SectionHeader title="Customer Rating" className="mb-3" />
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <svg
                  key={i}
                  className={`w-5 h-5 ${i < ticket.rating! ? "text-amber-400" : "text-muted-foreground/30"}`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            <span className="text-sm font-semibold text-foreground">{ticket.rating} / 5</span>
          </div>
          {ticket.ratingText && (
            <p className="mt-2 text-sm text-muted-foreground italic border-l-2 border-amber-300 pl-3">
              "{ticket.ratingText}"
            </p>
          )}
        </div>
      )}

      {ticket.status === STATUS.CLOSED && ticket.rating == null && (
        <div className="border rounded-lg p-4 bg-muted/20">
          <SectionHeader title="Customer Rating" className="mb-1" />
          <p className="text-sm text-muted-foreground">No rating submitted yet.</p>
        </div>
      )}
    </div>
  );
}

export { TicketDetail };
