import { useStaffSupportRole } from "@/hooks/useStaffSupportRole";
import { ListPagination } from "@/components/ListPagination";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Inbox, Search, SlidersHorizontal, BookmarkPlus, RefreshCw, ArrowUpDown, LayoutGrid, UsersRound, X, Clock3 } from "lucide-react";
import { QUEUE_KEYS, QUEUE_LABELS, PRIORITIES, STATUSES, TICKET_TYPES, ROLES, queueQuerySchema, canApplyTicketChange, type TicketChange, type QueueQuery, type PriorityValue, type StatusValue } from "@tms/core";
import { useSession } from "@/lib/auth-client";
import { WORK_API, workOptionsQuery, queueUrl, workError, readableOrganizationName, type QueueResponse, type SavedView } from "@/lib/work-client";
import { PRIORITY_LABELS, STATUS_LABELS, CATEGORY_LABELS } from "@/lib/ticket-badges";
import { STATUS_CONFIG, PRIORITY_CONFIG } from "@/lib/status-config";
import { TicketPill } from "@/components/TicketPill";
import { EnumSelect } from "@/components/EnumSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

const formatDate = (value: string) => new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const selectClass = "h-9 rounded-lg border border-input bg-background px-3 text-sm min-w-0";

export default function StaffQueues() {
  const { data: session } = useSession();
  const actor = { id: session?.user.id ?? "", role: (session?.user as { role?: string } | undefined)?.role ?? "" };
  const supportRole = useStaffSupportRole(session?.user.id).data;
  const isAdmin = !supportRole && actor.role === ROLES.ADMIN;
  const canManageTickets = isAdmin || supportRole === "TSA";
  const cache = useQueryClient();
  const [params, setParams] = useSearchParams();
  const parsed = queueQuerySchema.safeParse({ queue: canManageTickets ? "all" : "mine", ...Object.fromEntries(params) });
  const filters = parsed.success ? parsed.data : queueQuerySchema.parse({});
  const scope = params.toString();
  const [selection, setSelection] = useState<{ scope: string; ids: string[] }>({ scope: "", ids: [] });
  const selected = selection.scope === scope ? selection.ids : [];
  const [notice, setNotice] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const hasFilters = !!(filters.priority || filters.status || filters.type || filters.organizationId || filters.teamId);
  const [saveOpen, setSaveOpen] = useState(false);
  const [viewName, setViewName] = useState("");
  const [field, setField] = useState<TicketChange["field"]>("priority");
  const [value, setValue] = useState("HIGH");
  const [summary, setSummary] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const options = useQuery(workOptionsQuery);
  const queue = useQuery({
    queryKey: ["staff-queue", actor.id, filters], enabled: parsed.success && !!actor.id,
    queryFn: async () => (await axios.get<QueueResponse>(`${WORK_API}/queue`, { params: queueUrl(filters), withCredentials: true })).data,
  });
  const views = useQuery({ queryKey: ["queue-views", actor.id], enabled: !!actor.id, queryFn: async () => (await axios.get<SavedView[]>(`${WORK_API}/views`, { withCredentials: true })).data });
  const changeFilter = (key: keyof QueueQuery, next: string) => {
    const update = new URLSearchParams(params);
    if (next) update.set(key, next); else update.delete(key);
    if (key !== "page") update.set("page", "1");
    setParams(update);
    setNotice("");
  };
  const save = useMutation({
    mutationFn: () => axios.post(`${WORK_API}/views`, { name: viewName, filters }, { withCredentials: true }),
    onSuccess: () => { void cache.invalidateQueries({ queryKey: ["queue-views"] }); setSaveOpen(false); setViewName(""); setNotice("Personal view saved."); },
  });
  const removeView = useMutation({ mutationFn: (id: string) => axios.delete(`${WORK_API}/views/${id}`, { withCredentials: true }), onSuccess: () => { void cache.invalidateQueries({ queryKey: ["queue-views"] }); } });
  const bulk = useMutation({
    mutationFn: (change: TicketChange) => axios.post<{ updated: number; unchanged: number }>(`${WORK_API}/bulk`, { ticketIds: selected, change }, { withCredentials: true }),
    onSuccess: ({ data }) => {
      setConfirmOpen(false); setSelection({ scope, ids: [] }); setSummary("");
      setNotice(`${data.updated} ticket${data.updated === 1 ? "" : "s"} updated${data.unchanged ? `; ${data.unchanged} already matched` : ""}.`);
      void cache.invalidateQueries({ queryKey: ["staff-queue"] });
      void cache.invalidateQueries({ queryKey: ["ticket"] });
      void cache.invalidateQueries({ queryKey: ["ticket-history"] });
    },
  });
  function makeChange(): TicketChange | null {
    switch (field) {
      case "assignedToId": return { field, value: value === "none" ? null : value };
      case "teamId": return { field, value: value === "none" ? null : value };
      case "priority": return PRIORITIES.includes(value as PriorityValue) ? { field, value: value as PriorityValue } : null;
      case "status": return STATUSES.includes(value as StatusValue) ? { field, value: value as StatusValue, ...(summary.trim() ? { resolutionSummary: summary.trim() } : {}) } : null;
      case "dueAt": return value && !Number.isNaN(new Date(value).getTime()) ? { field, value: new Date(value).toISOString() } : value === "" ? { field, value: null } : null;
    }
  }
  const change = makeChange();
  const selectedRows = queue.data?.data.filter((row) => selected.includes(row.ticketId)) ?? [];
  const headedProjects = options.data?.headedProjects ?? [];
  const leadsSelectedProjects = selectedRows.length > 0 && selectedRows.every((row) => !!row.hrmsProjectId && headedProjects.includes(row.hrmsProjectId));
  const permitted = !!change && selectedRows.length === selected.length && selectedRows.every((row) => {
    if (canManageTickets) return true;
    if (change.field === "assignedToId" && row.hrmsProjectId) return canManageTickets || headedProjects.includes(row.hrmsProjectId);
    return canApplyTicketChange(actor, row, change, options.data?.myTeamIds ?? []);
  });
  const needsSummary = field === "status" && value === "OPEN_DONE" && !summary.trim();
  const allSelected = !!queue.data?.data.length && queue.data.data.every((row) => selected.includes(row.ticketId));
  const toggle = (id: string) => { setSelection({ scope, ids: selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id] }); bulk.reset(); };
  const resetField = (next: TicketChange["field"]) => {
    setField(next); setValue(next === "priority" ? "HIGH" : next === "status" ? "OPEN_IN_PROGRESS" : next === "assignedToId" ? (canManageTickets || leadsSelectedProjects ? "none" : actor.id) : next === "teamId" ? "none" : ""); bulk.reset();
  };

  return <div className="mx-auto max-w-[1600px] space-y-5 p-4 sm:p-6 lg:p-8">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Work queues</h1>
      <div className="flex gap-2"><Button variant="outline" render={<Link to="/tickets" />}><LayoutGrid size={16} />Priority board</Button>{isAdmin && <Button variant="outline" render={<Link to="/teams" />}><UsersRound size={16} />Manage teams</Button>}</div>
    </header>
    <nav aria-label="Work queues" className="flex gap-2 overflow-x-auto border-b border-border">
      {QUEUE_KEYS.map((key) => <button key={key} type="button" aria-pressed={filters.queue === key} onClick={() => changeFilter("queue", key)} className="flex shrink-0 items-center gap-2 border-b-2 border-transparent px-3 py-3 text-sm font-medium text-muted-foreground hover:text-foreground aria-pressed:border-primary aria-pressed:text-primary">
        {QUEUE_LABELS[key]}
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs tabular-nums">{queue.data?.counts[key] ?? "—"}</span>
      </button>)}
    </nav>
    {!!views.data?.length && <div className="flex items-center flex-wrap gap-2 text-xs text-muted-foreground"><span>Personal views</span>{views.data.map((view) => <span key={view.id} className="inline-flex items-center rounded-md border bg-card"><button className="px-3 py-1.5 hover:text-primary" onClick={() => { setParams(queueUrl(view.filters)); setNotice(""); }}>{view.name}</button><button aria-label={`Delete view ${view.name}`} className="pr-2 hover:text-destructive" disabled={removeView.isPending} onClick={() => removeView.mutate(view.id)}><X size={12} /></button></span>)}</div>}
    {!parsed.success && <p role="alert" className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">This queue URL contains invalid filters. <button className="underline" onClick={() => setParams({})}>Reset filters</button></p>}
    {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    {(removeView.isError || views.isError || options.isError) && <p role="alert" className="text-sm text-destructive">{removeView.isError ? workError(removeView.error) : "Some queue options could not be loaded. Refresh to try again."}</p>}
    <section className="rounded-xl border bg-card overflow-hidden">
      <div className="p-4 border-b space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:mr-auto sm:w-80">
            <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" aria-hidden="true" />
            <Input aria-label="Search work queues" className="pl-9" placeholder="Search tickets…" maxLength={200} value={filters.search} onChange={(e) => changeFilter("search", e.target.value)} />
          </div>
          <Button variant="outline" aria-expanded={showFilters} aria-controls="queue-filters" onClick={() => setShowFilters(!showFilters)}>
            <SlidersHorizontal size={15} />{hasFilters ? "Filters active" : "Filters"}
          </Button>
          <Button variant="outline" disabled={queue.isFetching || !parsed.success} onClick={() => { void queue.refetch(); }} aria-label="Refresh queue"><RefreshCw size={15} className={queue.isFetching ? "animate-spin" : ""} /></Button>
          <Button variant="outline" onClick={() => setSaveOpen(true)} disabled={!parsed.success}><BookmarkPlus size={15} />Save view</Button>
        </div>
        <div id="queue-filters" className={showFilters ? "flex flex-wrap items-center gap-2 border-t pt-3" : "hidden"}>
          <div><span className="sr-only">Priority filter</span><EnumSelect value={filters.priority ?? "all"} options={["all", ...PRIORITIES]} labels={{ all: "All priorities", ...PRIORITY_LABELS }} onValueChange={(next) => changeFilter("priority", next === "all" ? "" : next)} /></div>
          <EnumSelect value={filters.status ?? "all"} options={["all", ...STATUSES]} labels={{ all: "All statuses", ...STATUS_LABELS }} onValueChange={(next) => changeFilter("status", next === "all" ? "" : next)} />
          <EnumSelect value={filters.type ?? "all"} options={["all", ...TICKET_TYPES]} labels={{ all: "All categories", ...CATEGORY_LABELS }} onValueChange={(next) => changeFilter("type", next === "all" ? "" : next)} />
          <select aria-label="Organization filter" className={selectClass} value={filters.organizationId ?? ""} onChange={(e) => changeFilter("organizationId", e.target.value)}><option value="">All organizations</option>{options.data?.organizations.map((o) => <option key={o.id} value={o.id}>{readableOrganizationName(o.name) ?? "Organization name unavailable"}</option>)}</select>
          <select aria-label="Team filter" className={selectClass} value={filters.teamId ?? ""} onChange={(e) => changeFilter("teamId", e.target.value)}><option value="">All teams</option>{options.data?.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select>
          <select aria-label="Sort tickets" className={selectClass} value={filters.sortBy} onChange={(e) => changeFilter("sortBy", e.target.value)}><option value="updatedAt">Last updated</option><option value="createdAt">Created date</option><option value="dueAt">Due date</option><option value="priority">Priority</option><option value="ticketId">Reference</option><option value="title">Subject</option></select>
          <Button variant="ghost" size="sm" aria-label={`Sort ${filters.sortOrder === "desc" ? "ascending" : "descending"}`} onClick={() => changeFilter("sortOrder", filters.sortOrder === "desc" ? "asc" : "desc")}><ArrowUpDown size={14} />{filters.sortOrder === "desc" ? "Descending" : "Ascending"}</Button>
          <Button variant="ghost" size="sm" onClick={() => { setParams({ queue: filters.queue }); setNotice(""); }}>Clear filters</Button>
        </div>
      </div>
      {!!selected.length && <div className="p-4 border-b bg-muted/40 space-y-3"><div className="flex flex-wrap items-center gap-3"><span className="text-sm font-semibold">{selected.length} selected</span>
        <select aria-label="Bulk action" className={selectClass} value={field} onChange={(e) => resetField(e.target.value as TicketChange["field"])}><option value="priority">Set priority</option><option value="status">Change status</option><option value="assignedToId">{canManageTickets || leadsSelectedProjects ? "Assign tickets" : "Claim / unassign"}</option>{canManageTickets && <><option value="teamId">Move to team</option><option value="dueAt">Set due date</option></>}</select>
        {field === "priority" ? <EnumSelect value={value} options={PRIORITIES} labels={PRIORITY_LABELS} onValueChange={setValue} /> : field === "status" ? <EnumSelect value={value} options={STATUSES} labels={STATUS_LABELS} onValueChange={setValue} /> : field === "dueAt" ? <Input aria-label="Bulk due date" type="datetime-local" className="w-auto" value={value} onChange={(e) => setValue(e.target.value)} /> : <select aria-label="Bulk target" className={selectClass} value={value} onChange={(e) => setValue(e.target.value)}><option value="none">{field === "teamId" ? "No team" : "Unassigned"}</option>{(field === "teamId" ? options.data?.teams : canManageTickets || leadsSelectedProjects ? options.data?.staff : options.data?.staff.filter((staff) => staff.id === actor.id))?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>}
        <Button disabled={!permitted || needsSummary || bulk.isPending} onClick={() => setConfirmOpen(true)}>Review change</Button><Button variant="ghost" onClick={() => setSelection({ scope, ids: [] })}>Cancel selection</Button>
      </div>{field === "status" && value === "OPEN_DONE" && <Textarea aria-label="Bulk resolution summary" placeholder="Explain how the selected requests were resolved." maxLength={5000} value={summary} onChange={(e) => setSummary(e.target.value)} />}
      {!permitted && <p className="text-xs text-muted-foreground">You can edit tickets you own and claim eligible requests. Assigning project tickets requires the project head or an administrator.</p>}
      {bulk.isError && <p role="alert" className="text-sm text-destructive">{workError(bulk.error)}</p>}</div>}
      {queue.isError ? <div role="alert" className="p-8 text-sm text-destructive">Unable to load this queue. <button className="underline" onClick={() => { void queue.refetch(); }}>Try again</button></div> : queue.isPending ? <p className="p-10 text-sm text-muted-foreground">Loading your queue…</p> : !queue.data?.data.length ? <div className="text-center py-16 px-5"><Inbox className="mx-auto size-10 text-muted-foreground/60 mb-4" /><h2 className="font-medium">No tickets in this view</h2><p className="text-sm text-muted-foreground mt-2">Try another queue or adjust your filters.</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-sm"><thead className="bg-muted/30 text-muted-foreground border-b"><tr><th className="p-4 w-10"><input type="checkbox" aria-label="Select all tickets on this page" checked={allSelected} onChange={() => { setSelection({ scope, ids: allSelected ? [] : queue.data!.data.map((row) => row.ticketId) }); bulk.reset(); }} /></th>{["Ticket", "Priority", "Status", "Organization", "Assignee / team", "Due", "Updated"].map((heading) => <th key={heading} className="py-3 px-3 text-left font-medium text-xs">{heading}</th>)}</tr></thead><tbody>{queue.data.data.map((row) => {
        const overdue = row.dueAt && new Date(row.dueAt).getTime() < new Date(queue.data.asOf).getTime() && row.status !== "CLOSED" && row.status !== "OPEN_DONE";
        return <tr key={row.ticketId} className={`border-b last:border-0 hover:bg-muted/30 ${selected.includes(row.ticketId) ? "bg-primary/5" : ""}`}><td className="p-4"><input type="checkbox" aria-label={`Select ${row.ticketId}`} checked={selected.includes(row.ticketId)} onChange={() => toggle(row.ticketId)} /></td><td className="px-3 py-4 max-w-80"><Link to={`/tickets/${row.ticketId}?returnTo=${encodeURIComponent(`/work?${params.toString()}`)}`} className="block hover:text-primary"><span className="text-[11px] font-mono text-muted-foreground block mb-1">{row.ticketId}</span><span className="font-medium line-clamp-2">{row.title}</span></Link><p className="text-xs text-muted-foreground mt-1 truncate">{row.senderName ?? row.senderEmail ?? row.createdBy.name}</p></td><td className="px-3"><TicketPill label={PRIORITY_LABELS[row.priority]} cfg={PRIORITY_CONFIG[row.priority]} /></td><td className="px-3"><TicketPill label={STATUS_LABELS[row.status]} cfg={STATUS_CONFIG[row.status]} /></td><td className="px-3 text-xs text-muted-foreground">{readableOrganizationName(row.organization?.name) ?? readableOrganizationName(row.hrmsClientName) ?? (row.organization || row.hrmsClientName ? "Organization name unavailable" : "Internal / email")}</td><td className="px-3"><span className="text-xs font-medium">{row.assignedTo?.name ?? "Unassigned"}</span><span className="block text-xs text-muted-foreground mt-1">{row.team?.name ?? "No team"}</span></td><td className={`px-3 text-xs whitespace-nowrap ${overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>{row.dueAt ? <span className="inline-flex items-center gap-1"><Clock3 size={12} />{formatDate(row.dueAt)}{overdue ? " · overdue" : ""}</span> : "—"}</td><td className="px-3 text-xs text-muted-foreground whitespace-nowrap">{formatDate(row.updatedAt)}</td></tr>;
      })}</tbody></table></div>}
      <footer className="p-4 border-t flex flex-wrap justify-between items-center gap-3 text-xs text-muted-foreground"><span>{queue.data?.total ?? 0} tickets · Page {filters.page} of {Math.max(1, queue.data?.totalPages ?? 1)}{filters.queue === "recent" ? " · Updated in the last 7 days" : ""}</span><ListPagination page={filters.page} totalPages={queue.data?.totalPages ?? 1} disabled={queue.isFetching || !parsed.success} onPageChange={(page) => changeFilter("page", String(page))} pageSize={filters.pageSize} onPageSizeChange={(size) => changeFilter("pageSize", String(size))} /></footer>
    </section>
    <Dialog open={saveOpen} onOpenChange={setSaveOpen}><DialogContent><DialogHeader><DialogTitle>Save personal view</DialogTitle><DialogDescription>Your current queue, filters and sorting will be saved to your account.</DialogDescription></DialogHeader><form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4"><Input aria-label="View name" required maxLength={80} placeholder="e.g. Critical payroll requests" value={viewName} onChange={(e) => setViewName(e.target.value)} />{save.isError && <p role="alert" className="text-sm text-destructive">{workError(save.error)}</p>}<Button type="submit" disabled={!viewName.trim() || save.isPending}>Save view</Button></form></DialogContent></Dialog>
    <Dialog open={confirmOpen} onOpenChange={(open) => { if (!bulk.isPending) setConfirmOpen(open); }}><DialogContent><DialogHeader><DialogTitle>Apply change to {selected.length} tickets?</DialogTitle><DialogDescription>The server checks every ticket and applies the change only if all selected tickets are eligible.</DialogDescription></DialogHeader><p className="text-sm break-words">{selected.join(", ")}</p>{bulk.isError && <p role="alert" className="text-sm text-destructive">{workError(bulk.error)}</p>}<DialogFooter><Button variant="outline" disabled={bulk.isPending} onClick={() => setConfirmOpen(false)}>Cancel</Button><Button disabled={bulk.isPending || !permitted || needsSummary} onClick={() => { if (change) bulk.mutate(change); }}>{bulk.isPending ? "Applying…" : "Apply change"}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
