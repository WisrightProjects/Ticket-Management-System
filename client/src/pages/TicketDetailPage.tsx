import { useEffect, useState } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { apiTicketSchema, canClaimStaffTicket, canEditStaffTicket, ROLES } from "@tms/core";
import { useSession } from "@/lib/auth-client";
import { WORK_API, workOptionsQuery, workError } from "@/lib/work-client";
import { TicketDetail, TicketIdentity } from "@/components/TicketDetail";
import { TicketReplies } from "@/components/TicketReplies";
import { TicketMetaSidebar } from "@/components/TicketMetaSidebar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronLeft, History, MessagesSquare, SlidersHorizontal } from "lucide-react";
import { TicketActivity } from "@/components/TicketActivity";
import { TicketRoutingFields } from "@/components/TicketRoutingFields";
import { ticketReturnPath } from "@/lib/ticket-navigation";

function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const ticketId = id ?? "";
  const { data: session } = useSession();
  const { search } = useLocation();
  const [tab, setTab] = useState<"conversation" | "activity">("conversation");
  const cache = useQueryClient();
  const actor = { id: session?.user.id ?? "", role: (session?.user as { role?: string } | undefined)?.role ?? "" };
  const ticket = useQuery({ queryKey: ["ticket", ticketId], queryFn: async () => apiTicketSchema.parse((await axios.get(`${import.meta.env.VITE_API_URL || ""}/api/tickets/${ticketId}`, { withCredentials: true })).data), enabled: !!ticketId });
  const permissions = ticket.data?.supportPermissions;
  const canManageTicket = permissions?.manage ?? (!permissions && actor.role === ROLES.ADMIN);
  const options = useQuery({ ...workOptionsQuery, enabled: !canManageTicket && !!actor.id });
  const workTicket = { assignedToId: ticket.data?.assignedTo?.id ?? null, teamId: ticket.data?.teamId ?? null };
  const canEdit = canManageTicket || (!permissions && canEditStaffTicket(actor, workTicket));
  const projectId = ticket.data?.hrmsProjectId;
  const headsProject = permissions?.assign ?? (!!projectId && (options.data?.headedProjects?.includes(projectId) ?? false));
  const canClaim = !permissions && !projectId && !canEdit && !!ticket.data && canClaimStaffTicket(actor, workTicket, options.data?.myTeamIds ?? []);
  const claim = useMutation({ mutationFn: () => axios.post(`${WORK_API}/bulk`, { ticketIds: [ticketId], change: { field: "assignedToId", value: actor.id } }, { withCredentials: true }), onSuccess: () => { void cache.invalidateQueries({ queryKey: ["ticket", ticketId] }); void cache.invalidateQueries({ queryKey: ["ticket-history", ticketId] }); void cache.invalidateQueries({ queryKey: ["staff-queue"] }); } });
  const saveDetails = useMutation({
    mutationFn: (data: { title: string; description: string }) => axios.patch(
      `${import.meta.env.VITE_API_URL || ""}/api/tickets/${ticketId}/details`, data, { withCredentials: true },
    ),
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ["ticket", ticketId] });
      void cache.invalidateQueries({ queryKey: ["ticket-history", ticketId] });
      void cache.invalidateQueries({ queryKey: ["staff-queue"] });
    },
  });
  const returnTo = ticketReturnPath(search);
  useEffect(() => {
    document.documentElement.scrollTop = 0;
  }, [ticketId]);

  return (
    <div className="mx-auto w-full max-w-[1480px] space-y-4 px-4 py-4 sm:px-6 lg:px-8">
      <header className="rounded-xl border border-t-2 border-t-primary bg-card px-4 pb-4 pt-2 sm:px-6 sm:pb-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <Link to={returnTo} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2 text-muted-foreground")}>
            <ChevronLeft aria-hidden="true" />
            Back to {returnTo.startsWith("/work") ? "work queues" : "tickets"}
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            {ticket.data && <a href="#ticket-properties" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "lg:hidden")}>
              <SlidersHorizontal aria-hidden="true" />Properties
            </a>}
            {canClaim && <Button size="sm" disabled={claim.isPending || options.isPending} onClick={() => claim.mutate()}>{claim.isPending ? "Claiming…" : "Assign to me"}</Button>}
          </div>
        </div>
        {ticket.data && <TicketIdentity ticket={ticket.data} pageHeading />}
      </header>
      {claim.isError && <p role="alert" className="text-sm text-destructive">{workError(claim.error)}</p>}
      {ticket.data && !canEdit && !permissions && <p className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">{headsProject ? "As project head, you can assign this ticket to a project member." : "Viewing the shared support pool. Editing is available to the assignee and administrators."}</p>}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_19rem] xl:grid-cols-[minmax(0,1fr)_21rem]">
        <section className="min-w-0 overflow-hidden rounded-xl border bg-card">
          <div role="tablist" aria-label="Ticket workspace" className="flex gap-3 border-b bg-muted/35 px-4 sm:px-6">
            <button type="button" role="tab" id="conversation-tab" aria-selected={tab === "conversation"} aria-controls="ticket-conversation" className="flex items-center gap-2 border-b-2 border-transparent px-1 py-3 text-sm font-medium text-muted-foreground hover:text-foreground aria-selected:border-primary aria-selected:text-primary" onClick={() => setTab("conversation")}>
              <MessagesSquare className="size-4" aria-hidden="true" />Conversation
            </button>
            <button type="button" role="tab" id="activity-tab" aria-selected={tab === "activity"} aria-controls="ticket-activity" className="flex items-center gap-2 border-b-2 border-transparent px-1 py-3 text-sm font-medium text-muted-foreground hover:text-foreground aria-selected:border-primary aria-selected:text-primary" onClick={() => setTab("activity")}>
              <History className="size-4" aria-hidden="true" />Activity
            </button>
          </div>
          <div role="tabpanel" id="ticket-conversation" aria-labelledby="conversation-tab" hidden={tab !== "conversation"}>
            <div className="border-b px-4 py-4 sm:px-6">
              {canManageTicket && ticket.data && (
                <details className="mb-4 rounded-lg border bg-card p-4">
                  <summary className="cursor-pointer text-sm font-semibold">Edit ticket details</summary>
                  <form key={`${ticketId}:${ticket.data.title}:${ticket.data.description}`} className="mt-4 space-y-3" onSubmit={(event) => {
                    event.preventDefault();
                    const fields = new FormData(event.currentTarget);
                    saveDetails.mutate({ title: String(fields.get("title")), description: String(fields.get("description")) });
                  }}>
                    <Label htmlFor="edit-ticket-title">Title</Label>
                    <Input id="edit-ticket-title" name="title" required maxLength={255} defaultValue={ticket.data.title} />
                    <Label htmlFor="edit-ticket-description">Description</Label>
                    <Textarea id="edit-ticket-description" name="description" required maxLength={10000} defaultValue={ticket.data.description} />
                    {saveDetails.isError && <p role="alert" className="text-sm text-destructive">{workError(saveDetails.error)}</p>}
                    {saveDetails.isSuccess && <p role="status" className="text-sm">Ticket details saved.</p>}
                    <Button type="submit" size="sm" disabled={saveDetails.isPending}>Save ticket details</Button>
                  </form>
                </details>
              )}
              <TicketDetail key={ticketId} ticketId={ticketId} readOnly={!canEdit} embedded />
            </div>
            {ticket.data && <div className="px-4 py-4 sm:px-6">
              <TicketReplies key={`${actor.id}:${ticketId}`} ticketId={ticketId} draftOwnerId={actor.id || undefined} readOnly={permissions ? !permissions.note : !canEdit} internalOnly={permissions?.reply === false} />
            </div>}
          </div>
          <div role="tabpanel" id="ticket-activity" aria-labelledby="activity-tab" hidden={tab !== "activity"} className="px-4 py-4 sm:px-6">
            <TicketActivity ticketId={ticketId} />
          </div>
        </section>

        <aside id="ticket-properties" aria-label="Ticket properties" className="min-w-0 scroll-mt-20 space-y-4">
          <TicketMetaSidebar ticketId={ticketId} readOnly={!canEdit} isAdmin={canManageTicket} headsProject={headsProject} actorId={actor.id} />
          {ticket.data && <TicketRoutingFields key={`${ticketId}:${ticket.data.dueAt}`} ticket={ticket.data} isAdmin={canManageTicket} />}
        </aside>
      </div>
    </div>
  );
}

export default TicketDetailPage;
