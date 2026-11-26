import { useState } from "react";
import axios from "axios";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  apiCommentsSchema,
  apiTicketSchema,
  type ApiComment,
} from "@tms/core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ImageUploadField } from "@/components/portal/ImageUploadField";
import { ImageLightbox } from "@/components/ImageLightbox";
import { SectionHeader } from "@/components/SectionHeader";
import { useReplyDraft } from "@/hooks/useReplyDraft";

const API_URL = import.meta.env.VITE_API_URL || "";

const SENDER_TYPE_LABELS = {
  AGENT:    "Agent",
  CUSTOMER: "Customer",
} as const;


function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

interface CommentAttachment {
  id:       string;
  url:      string;
  filename: string;
}

function CommentAttachments({ attachments }: { attachments: CommentAttachment[] }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  return (
    <>
      <div className="mt-2 flex flex-wrap gap-2">
        {attachments.map((att, idx) => (
          <button
            key={att.id}
            type="button"
            onClick={() => setLightboxIndex(idx)}
            className="group relative block w-16 h-16 rounded overflow-hidden border border-border hover:border-accent transition-colors cursor-pointer"
            title={att.filename}
          >
            <img src={att.url} alt={att.filename} className="w-full h-full object-cover" loading="lazy" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
            <p className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[10px] px-1 truncate">{att.filename}</p>
          </button>
        ))}
      </div>
      {lightboxIndex !== null && (
        <ImageLightbox
          images={attachments.map((a) => ({ url: a.url, filename: a.filename }))}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  );
}

interface TicketRepliesProps {
  ticketId: string;
  draftOwnerId?: string;
  readOnly?: boolean;
  internalOnly?: boolean;
}

/**
 * Self-contained reply thread + form for a single ticket.
 * Handles the comments query, reply mutation, and all local state.
 * Used on the TicketDetail page below the description section.
 */
function TicketReplies({ ticketId, draftOwnerId, readOnly = false, internalOnly = false }: TicketRepliesProps) {
  const queryClient = useQueryClient();
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [internalSelected, setIsInternal] = useState(false);
  const isInternal = internalOnly || internalSelected;
  const draft = useReplyDraft(draftOwnerId, ticketId);
  const mode = isInternal ? "internal" : "public";
  const content = draft.get(mode);
  const setContent = (text: string) => draft.set(mode, text);

  // Re-uses the cache populated by TicketDetail — no extra network request
  const { data: ticket } = useQuery({
    queryKey: ["ticket", ticketId],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/tickets/${ticketId}`, { withCredentials: true });
      return apiTicketSchema.parse(res.data);
    },
    enabled: !!ticketId,
    staleTime: 60_000,
  });

  const { data: comments = [], isLoading, isError: commentsError } = useQuery<ApiComment[]>({
    queryKey: ["comments", ticketId],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/tickets/${ticketId}/comments`, { withCredentials: true });
      return apiCommentsSchema.parse(res.data);
    },
    enabled: !!ticketId,
  });

  const replyMutation = useMutation({
    mutationFn: (message: { content: string; isInternal: boolean; files: File[] }) => {
      const fd = new FormData();
      fd.append("content", message.content);
      fd.append("isInternal", String(message.isInternal));
      for (const file of message.files) {
        fd.append("attachments", file);
      }
      return axios.post(`${API_URL}/api/tickets/${ticketId}/comments`, fd, { withCredentials: true });
    },
    onSuccess: (_response, message) => {
      void queryClient.invalidateQueries({ queryKey: ["comments", ticketId] });
      void queryClient.invalidateQueries({ queryKey: ["ticket", ticketId] });
      void queryClient.invalidateQueries({ queryKey: ["staff-queue"] });
      draft.clearSent(message.isInternal ? "internal" : "public", message.content);
      setAttachmentFiles([]);
    },
  });

  const polishMutation = useMutation({
    mutationFn: (message: { content: string; mode: "public" | "internal" }) =>
      axios.post<{ polished: string }>(
        `${API_URL}/api/tickets/${ticketId}/polish`,
        { content: message.content },
        { withCredentials: true },
      ),
    onSuccess: (res, message) => {
      if (draft.get(message.mode) === message.content) draft.set(message.mode, res.data.polished);
    },
  });

  return (
    <div>
      <SectionHeader
        title={`Replies${comments.length > 0 ? ` (${comments.length})` : ""}`}
        className="mb-3 normal-case text-sm font-medium"
      />

      <div className="space-y-3 mb-4">
        {/* Agent / subsequent replies */}
        {isLoading && <Skeleton className="h-16 w-full" />}
        {commentsError && <p role="alert" className="text-sm text-destructive">Unable to load the conversation. Refresh to try again.</p>}
        {!isLoading && !commentsError && comments.length === 0 && <p className="text-sm text-muted-foreground">No replies yet.</p>}

        {!isLoading && comments.map((c) => (
          <div
            key={c.id}
            className={`border rounded-lg p-4 ${c.isInternal ? "bg-amber-50/60 dark:bg-amber-950/20 border-amber-200" : c.senderType === "CUSTOMER" ? "bg-blue-50/50 dark:bg-blue-950/20" : "bg-muted/10"}`}
          >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">
                {c.senderType === "CUSTOMER"
                  ? (ticket?.senderName ?? ticket?.createdBy.name ?? c.author.name)
                  : c.author.name}
              </span>
              <Badge variant="outline" className="text-xs py-0">
                {c.isInternal ? "Internal note" : SENDER_TYPE_LABELS[c.senderType]}
              </Badge>
              <span className="text-xs text-muted-foreground">{formatDate(c.createdAt)}</span>
            </div>
            <p className="break-words whitespace-pre-wrap text-sm leading-relaxed">{c.content}</p>
            {c.attachments && c.attachments.length > 0 && (
              <CommentAttachments attachments={c.attachments} />
            )}
          </div>
        ))}
      </div>

      {/* Reply form */}
      {readOnly ? <p className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">Claim this ticket or ask its assignee to respond. Only the assignee or an administrator can add replies and internal notes.</p> : <fieldset disabled={replyMutation.isPending} className={`min-w-0 space-y-3 rounded-lg border p-3 sm:p-4 ${isInternal ? "border-amber-200 bg-amber-50/50" : "bg-muted/30"}`}>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Message visibility">
          {!internalOnly && <Button type="button" size="sm" variant={isInternal ? "outline" : "default"} aria-pressed={!isInternal} onClick={() => setIsInternal(false)}>Public reply</Button>}
          <Button type="button" size="sm" variant={isInternal ? "default" : "outline"} aria-pressed={isInternal} onClick={() => setIsInternal(true)}>Internal note</Button>
        </div>
        <p id="reply-visibility" className="text-xs text-muted-foreground">{isInternal ? "Only staff can see this note and its attachments." : "This reply is visible to the customer."}</p>
        <Textarea
          aria-label={isInternal ? "Write an internal note" : "Write a public reply"}
          aria-describedby="reply-visibility"
          className="bg-card"
          placeholder="Write a reply…"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          maxLength={5000}
          disabled={replyMutation.isPending}
        />
        <ImageUploadField files={attachmentFiles} onChange={setAttachmentFiles} />
        {draftOwnerId && <p className="text-[11px] text-muted-foreground">Text drafts are kept in this browser tab until sent or signed out. Reattach files after leaving this page.</p>}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-3">
          <Button
            size="sm"
            variant="outline"
            onClick={() => polishMutation.mutate({ content, mode })}
            disabled={polishMutation.isPending || content.trim() === ""}
          >
            {polishMutation.isPending ? "Polishing…" : "Polish"}
          </Button>
          <Button
            size="sm"
            onClick={() => replyMutation.mutate({ content, isInternal, files: attachmentFiles })}
            disabled={replyMutation.isPending || content.trim() === ""}
          >
            {replyMutation.isPending ? "Posting…" : "Post Reply"}
          </Button>
        </div>
        {replyMutation.isError && (
          <p className="text-xs text-destructive">Failed to post reply. Please try again.</p>
        )}
        {polishMutation.isError && (
          <p className="text-xs text-destructive">Failed to polish reply. Please try again.</p>
        )}
      </fieldset>}
    </div>
  );
}

export { TicketReplies };
