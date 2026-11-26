import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import type { ApiTicket, TicketChange } from "@tms/core";
import { WORK_API, workOptionsQuery, workError } from "@/lib/work-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function localDateInput(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function TicketRoutingFields({ ticket, isAdmin }: { ticket: ApiTicket; isAdmin: boolean }) {
  const options = useQuery({ ...workOptionsQuery, enabled: isAdmin });
  const cache = useQueryClient();
  const [due, setDue] = useState(localDateInput(ticket.dueAt));
  const save = useMutation({
    mutationFn: (change: TicketChange) => axios.post(`${WORK_API}/bulk`, { ticketIds: [ticket.ticketId], change }, { withCredentials: true }),
    onSuccess: () => { void cache.invalidateQueries({ queryKey: ["ticket", ticket.ticketId] }); void cache.invalidateQueries({ queryKey: ["ticket-history", ticket.ticketId] }); void cache.invalidateQueries({ queryKey: ["staff-queue"] }); },
  });
  return <section className="rounded-xl border bg-card p-4 space-y-4"><h3 className="text-sm font-semibold">Routing & deadline</h3><div className="space-y-1"><p className="text-xs uppercase tracking-wide text-muted-foreground">Organization</p><p className="text-sm">{ticket.organization?.name ?? ticket.hrmsClientName ?? "Internal / email"}</p></div><div className="space-y-2"><label htmlFor="ticket-team" className="text-xs font-medium">Team</label>{isAdmin ? <select id="ticket-team" value={ticket.teamId ?? ""} disabled={save.isPending || options.isPending || options.isError} onChange={(e) => save.mutate({ field: "teamId", value: e.target.value || null })} className="w-full rounded-lg border bg-background p-2 text-sm"><option value="">No team</option>{options.data?.teams?.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select> : <p className="text-sm">{ticket.team?.name ?? "No team"}</p>}</div><div className="space-y-2"><label htmlFor="ticket-due" className="text-xs font-medium">Due date</label>{isAdmin ? <><Input id="ticket-due" type="datetime-local" value={due} disabled={save.isPending} onChange={(e) => setDue(e.target.value)} /><div className="flex gap-2"><Button size="sm" variant="outline" disabled={save.isPending || due === localDateInput(ticket.dueAt)} onClick={() => save.mutate({ field: "dueAt", value: due ? new Date(due).toISOString() : null })}>Save deadline</Button>{due && <Button size="sm" variant="ghost" disabled={save.isPending} onClick={() => { setDue(""); save.mutate({ field: "dueAt", value: null }); }}>Clear</Button>}</div></> : <p className="text-sm">{ticket.dueAt ? new Date(ticket.dueAt).toLocaleString() : "No deadline set"}</p>}<p className="text-[11px] text-muted-foreground">Ticket deadline in your local time. SLA targets are configured separately.</p></div>{options.isError && <p role="alert" className="text-xs text-destructive">Team options could not be loaded.</p>}{save.isError && <p role="alert" className="text-xs text-destructive">{workError(save.error)}</p>}</section>;
}
