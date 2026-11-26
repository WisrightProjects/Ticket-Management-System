import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useQuery, useInfiniteQuery, type UseInfiniteQueryResult, type InfiniteData } from "@tanstack/react-query";
import {
  paginatedTicketsSchema,
  type ApiTicket,
  TICKET_TYPE,
  TICKET_TYPES,
  STATUSES,
  type TicketTypeValue,
  type PriorityValue,
  type StatusValue,
} from "@tms/core";
import {
  CATEGORY_CLASS,
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
} from "@/lib/ticket-badges";
import { STATUS_CONFIG, PRIORITY_CONFIG as SHARED_PRIORITY_CONFIG } from "@/lib/status-config";
import { TicketSlidePanel } from "@/components/TicketSlidePanel";
import { PageHeader } from "@/components/PageHeader";
import { ErrorBanner } from "@/components/ErrorBanner";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Link, useSearchParams } from "react-router-dom";
import { ticketDetailPath } from "@/lib/ticket-navigation";
import {
  ChevronUp,
  ChevronDown,
  Eye,
  X,
  Search,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "";

// Tab filter buckets — drives the type[] sent to GET /api/tickets
type TabFilter = "all" | "bug" | "impl" | "reopened";
type DateView = "today" | "previous" | "all" | "custom";
const BUG_TYPES: readonly TicketTypeValue[] = [
  TICKET_TYPE.BUG,
  TICKET_TYPE.REQUIREMENT,
  TICKET_TYPE.TASK,
  TICKET_TYPE.SUPPORT,
  TICKET_TYPE.EXPLANATION,
];
const IMPL_TYPES: readonly TicketTypeValue[] = [TICKET_TYPE.IMPLEMENTATION];

// ── Priority display config — derived from the shared PRIORITY_CONFIG tokens ──

const PRIORITY_CONFIG: Record<string, { bar: string; textDark: string; textLight: string }> =
  Object.fromEntries(
    Object.entries(SHARED_PRIORITY_CONFIG).map(([k, v]) => [
      k,
      { bar: v.dot, textDark: v.text, textLight: v.text },
    ])
  );

// ── Sorting ───────────────────────────────────────────────────────────────────

interface Sorting {
  id: string;
  desc: boolean;
}

const SORT_FIELDS: { value: string; label: string }[] = [
  { value: "status", label: "Status" },
  { value: "type", label: "Category" },
  { value: "priority", label: "Priority" },
  { value: "createdAt", label: "Date Created" },
  { value: "lastCustomerReplyAt", label: "Last Active" },
];

// ── Priority board columns (Critical → Low) ─────────────────────────────────

interface CommonFilters {
  sorting: Sorting;
  search: string;
  status: StatusValue | "";
  type: readonly TicketTypeValue[] | null;
  assigneeFilter: string;
  clientFilter: string;
  organizationFilter: string;
  dateFrom: string;
  dateTo: string;
}

function usePriorityTicketColumn(priority: PriorityValue, filters: CommonFilters, pageSize = 10) {
  return useInfiniteQuery({
    queryKey: [
      "tickets", "board", priority, filters.sorting, filters.search,
      filters.status, filters.type, filters.assigneeFilter,
      filters.clientFilter, filters.organizationFilter, filters.dateFrom, filters.dateTo,
    ],
    queryFn: async ({ pageParam }: { pageParam: number }) => {
      const params = new URLSearchParams({
        sortBy:   filters.sorting.id,
        sortOrder: filters.sorting.desc ? "desc" : "asc",
        page:     String(pageParam),
        pageSize: String(pageSize),
        priority,
      });
      if (filters.search) params.set("search", filters.search);
      if (filters.status) params.set("status", filters.status);
      if (filters.type) {
        for (const t of filters.type) params.append("type", t);
      }
      if (filters.assigneeFilter) params.set("assignedToId", filters.assigneeFilter);
      if (filters.clientFilter)   params.set("clientId", filters.clientFilter);
      if (filters.organizationFilter) params.set("organizationId", filters.organizationFilter);
      if (filters.dateFrom)       params.set("from", new Date(`${filters.dateFrom}T00:00:00`).toISOString());
      if (filters.dateTo)         params.set("to", new Date(`${filters.dateTo}T23:59:59.999`).toISOString());
      const res = await axios.get(`${API_URL}/api/tickets?${params}`, { withCredentials: true });
      return paginatedTicketsSchema.parse(res.data);
    },
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  });
}

type TicketPage = ReturnType<typeof paginatedTicketsSchema.parse>;
type ColumnQuery = UseInfiniteQueryResult<InfiniteData<TicketPage>>;

function PriorityColumn({
  label,
  q,
  onQuickView,
  returnTo,
}: {
  priority: PriorityValue;
  label: string;
  q: ColumnQuery;
  onQuickView: (t: ApiTicket) => void;
  returnTo?: string;
}) {
  const tickets = q.data?.pages.flatMap((p: TicketPage) => p.data) ?? [];
  const total   = q.data?.pages[0]?.total;

  return (
    <div
      className="flex flex-col flex-shrink-0 snap-center sm:flex-1 sm:min-w-[280px] w-[85vw] max-w-[340px] sm:w-auto sm:max-w-none rounded-xl overflow-hidden"
      style={{ border: "1px solid var(--rt-border)", background: "var(--rt-surface)", maxHeight: "calc(100vh - 260px)" }}
    >
      <div className="flex items-center justify-between px-3 py-2.5 flex-shrink-0" style={{ borderBottom: "1px solid var(--rt-border)" }}>
        <span data-testid="priority-column-label" className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--rt-text-2)" }}>
          {label}
        </span>
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ background: "var(--rt-surface-2)", color: "var(--rt-text-2)" }}
        >
          {q.isLoading ? "…" : total}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {q.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <TicketCardSkeleton key={i} />)
        ) : tickets.length === 0 ? (
          <EmptyState icon={Search} title={`No ${label} tickets`} />
        ) : (
          <>
            {tickets.map((ticket) => (
              <TicketCard key={ticket.id} ticket={ticket} onQuickView={onQuickView} returnTo={returnTo} />
            ))}
            {q.hasNextPage && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                disabled={q.isFetchingNextPage}
                onClick={() => q.fetchNextPage()}
              >
                {q.isFetchingNextPage ? "Loading…" : "Load more"}
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Ticket card ───────────────────────────────────────────────────────────────

function TicketCard({ ticket, onQuickView, returnTo }: { ticket: ApiTicket; onQuickView: (t: ApiTicket) => void; returnTo?: string }) {
  const sc = STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG.CLOSED;
  const pc = PRIORITY_CONFIG[ticket.priority] ?? PRIORITY_CONFIG.LOW;
  const created = new Date(ticket.createdAt);
  const lastActive = ticket.lastCustomerReplyAt ? new Date(ticket.lastCustomerReplyAt) : null;

  return (
    <Link
      to={ticketDetailPath(ticket.ticketId, returnTo)}
      data-testid="ticket-card"
      className="block rounded-xl p-4 transition-colors bg-[var(--rt-surface)] hover:bg-[var(--rt-surface-2)] no-underline"
      style={{ border: "1px solid var(--rt-border)" }}
    >
      {/* Row 1: ID + Status + Quick view */}
      <div className="flex items-center justify-between mb-2 gap-2">
        <span className="font-mono text-xs font-semibold" style={{ color: "var(--rt-accent)" }}>
          {ticket.ticketId}
        </span>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap"
            style={{ background: sc.bg, color: sc.text }}
          >
            <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: sc.dot }} />
            {STATUS_LABELS[ticket.status]}
          </span>
          <button
            data-testid="ticket-card-quickview"
            title="Quick view"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onQuickView(ticket);
            }}
            className="p-1 rounded-md opacity-40 hover:opacity-100 transition-opacity"
            style={{ color: "var(--rt-text-2)" }}
          >
            <Eye className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Row 2: Subject */}
      <p className="text-sm font-semibold mb-2 line-clamp-1" style={{ color: "var(--rt-text-1)" }}>
        {ticket.title}
      </p>

      {/* Row 3: Sender */}
      <div className="flex items-center gap-1 mb-3 min-w-0">
        <p className="text-xs font-medium truncate" style={{ color: "var(--rt-text-2)" }}>
          {ticket.senderName ?? ticket.createdBy?.name}
        </p>
        <span className="text-xs flex-shrink-0" style={{ color: "var(--rt-text-3)" }}>·</span>
        <p className="text-xs truncate" style={{ color: "var(--rt-text-3)" }}>
          {ticket.senderEmail ?? ticket.project}
        </p>
      </div>

      {/* Row 4: Priority + Category + Date */}
      <div className="flex items-center gap-3 flex-wrap mb-2">
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: pc.textDark }}>
          {PRIORITY_LABELS[ticket.priority]}
        </span>
        {CATEGORY_CLASS[ticket.type] ? (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${CATEGORY_CLASS[ticket.type]}`}
          >
            {CATEGORY_LABELS[ticket.type]}
          </span>
        ) : (
          <span className="text-xs" style={{ color: "var(--rt-text-3)" }}>
            {CATEGORY_LABELS[ticket.type]}
          </span>
        )}
        <span className="text-xs font-mono ml-auto whitespace-nowrap" style={{ color: "var(--rt-text-3)" }}>
          {created.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}{" "}
          {created.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>

      {/* Row 5: Last active */}
      <div
        className="text-xs font-mono pt-2"
        style={{
          borderTop: "1px solid var(--rt-border)",
          color: lastActive ? "var(--rt-accent)" : "var(--rt-text-3)",
          opacity: lastActive ? 1 : 0.6,
        }}
      >
        Last active:{" "}
        {lastActive
          ? `${lastActive.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} ${lastActive.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`
          : "—"}
      </div>
    </Link>
  );
}

function TicketCardSkeleton() {
  return (
    <div className="rounded-xl p-4" style={{ background: "var(--rt-surface)", border: "1px solid var(--rt-border)" }}>
      <div className="flex items-center justify-between mb-3">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-4 w-20 rounded-full" />
      </div>
      <Skeleton className="h-3 w-48 mb-2" />
      <Skeleton className="h-3 w-32 mb-3" />
      <div className="flex items-center gap-3">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-20 ml-auto" />
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

function localDateInput(date: Date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function readFilter<T extends string>(params: URLSearchParams, key: string, choices: readonly T[], fallback: T): T {
  return choices.find((choice) => choice === params.get(key)) ?? fallback;
}

function readDate(params: URLSearchParams, key: string) {
  const date = params.get(key) ?? "";
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(new Date(`${date}T00:00:00`).getTime()) ? date : "";
}

function Tickets() {
  const [searchParams] = useSearchParams();

  const [sorting, setSorting] = useState<Sorting>(() => ({
    id: readFilter(searchParams, "sortBy", SORT_FIELDS.map(({ value }) => value), "createdAt"),
    desc: searchParams.get("sortOrder") !== "asc",
  }));
  const [searchInput, setSearchInput]       = useState(searchParams.get("search")?.slice(0, 200) ?? "");
  const [search, setSearch]                 = useState(searchInput.trim());
  const [tabFilter, setTabFilter]           = useState<TabFilter>(() => readFilter(searchParams, "tab", ["all", "bug", "impl", "reopened"], "all"));
  const [statusFilter, setStatusFilter]     = useState<StatusValue | "">(() => readFilter(searchParams, "status", ["", ...STATUSES], ""));
  const [typeFilter, setTypeFilter]         = useState<TicketTypeValue | "">(() => readFilter(searchParams, "type", ["", ...TICKET_TYPES], ""));
  const [assigneeFilter, setAssigneeFilter] = useState(searchParams.get("assignedToId") ?? "");
  const [clientFilter,  setClientFilter]   = useState(searchParams.get("clientId") ?? "");
  const [organizationFilter, setOrganizationFilter] = useState(searchParams.get("organizationId") ?? "");
  const [dateFrom, setDateFrom]             = useState(() => readDate(searchParams, "from"));
  const [dateTo, setDateTo]                 = useState(() => readDate(searchParams, "to"));
  const [dateView, setDateView] = useState<DateView>(() => readFilter(searchParams, "date", ["today", "previous", "all", "custom"], "today"));
  const now = new Date();
  const today = localDateInput(now);
  const yesterday = localDateInput(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const [selectedTicket, setSelectedTicket] = useState<ApiTicket | null>(null);
  const closePanel = useCallback(() => setSelectedTicket(null), []);
  const returnFilters = new URLSearchParams();
  for (const [key, value] of Object.entries({
    search: searchInput.trim(), tab: tabFilter === "all" ? "" : tabFilter,
    status: statusFilter, type: typeFilter, assignedToId: assigneeFilter, clientId: clientFilter, organizationId: organizationFilter,
    date: dateView === "today" ? "" : dateView, from: dateView === "custom" ? dateFrom : "", to: dateView === "custom" ? dateTo : "",
    sortBy: sorting.id === "createdAt" ? "" : sorting.id, sortOrder: sorting.desc ? "" : "asc",
  })) {
    if (value) returnFilters.set(key, value);
  }
  const returnTo = returnFilters.size ? `/tickets?${returnFilters}` : undefined;

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const hasFilters =
    search !== "" || statusFilter !== "" || typeFilter !== "" ||
    assigneeFilter !== "" || clientFilter !== "" || organizationFilter !== "" || dateView !== "today";

  // Effective type filter sent to the server. Tabs win when active so the user
  // doesn't see contradictory filters (the dropdown is hidden in those tabs).
  const effectiveTypeFilter: readonly TicketTypeValue[] | null =
    tabFilter === "bug"      ? BUG_TYPES :
    tabFilter === "impl"     ? IMPL_TYPES :
    tabFilter === "reopened" ? null :
    typeFilter               ? [typeFilter] :
    null;

  // When the reopened tab is active, force status filter to REOPENED regardless
  // of what the status dropdown says.
  const effectiveStatusFilter: StatusValue | "" =
    tabFilter === "reopened" ? "REOPENED" : statusFilter;

  function clearFilters() {
    setSearchInput(""); setSearch("");
    setStatusFilter(""); setTypeFilter("");
    setAssigneeFilter(""); setClientFilter(""); setDateFrom(""); setDateTo("");
    setOrganizationFilter("");
    setDateView("today");
  }

  function changeSortField(id: string | null) {
    if (!id) return;
    setSorting((s) => ({ ...s, id }));
  }

  function toggleSortDirection() {
    setSorting((s) => ({ ...s, desc: !s.desc }));
  }

  const { data: agentUsers = [] } = useQuery({
    queryKey: ["assignable-users-all"],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/tickets/assignable-users`, { withCredentials: true });
      return res.data as Array<{ id: string; name: string }>;
    },
    staleTime: 60_000,
  });

  const { data: clientList = [] } = useQuery({
    queryKey: ["ticket-clients"],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/tickets/clients`, { withCredentials: true });
      return res.data as Array<{ id: string; name: string }>;
    },
    staleTime: 5 * 60_000,
  });

  const commonFilters: CommonFilters = {
    sorting, search,
    status: effectiveStatusFilter,
    type:   effectiveTypeFilter,
    assigneeFilter, clientFilter, organizationFilter,
    dateFrom: dateView === "today" ? today : dateView === "custom" ? dateFrom : "",
    dateTo: dateView === "today" ? today : dateView === "previous" ? yesterday : dateView === "custom" ? dateTo : "",
  };

  const criticalQ = usePriorityTicketColumn("CRITICAL", commonFilters);
  const highQ     = usePriorityTicketColumn("HIGH",     commonFilters);
  const mediumQ   = usePriorityTicketColumn("MEDIUM",   commonFilters);
  const lowQ      = usePriorityTicketColumn("LOW",      commonFilters);

  const columns: { priority: PriorityValue; label: string; q: ColumnQuery }[] = [
    { priority: "CRITICAL", label: PRIORITY_LABELS.CRITICAL, q: criticalQ },
    { priority: "HIGH",     label: PRIORITY_LABELS.HIGH,     q: highQ },
    { priority: "MEDIUM",   label: PRIORITY_LABELS.MEDIUM,   q: mediumQ },
    { priority: "LOW",      label: PRIORITY_LABELS.LOW,      q: lowQ },
  ];

  const isLoading = columns.some((c) => c.q.isLoading);
  const isError   = columns.some((c) => c.q.isError);
  const allLoaded = columns.every((c) => c.q.data);
  const total     = allLoaded ? columns.reduce((sum, c) => sum + (c.q.data!.pages[0]?.total ?? 0), 0) : 0;

  return (
    <>
    <div className="px-4 sm:px-6 py-4 sm:py-8">

        <PageHeader
          title={
            <>
              Tickets
              {!isLoading && (
                <span
                  data-testid="ticket-total-pill"
                  className="text-sm font-semibold px-2.5 py-0.5 rounded-full bg-[var(--rt-accent-bg)] text-[var(--rt-accent)] border border-[var(--rt-accent)]"
                >
                  {total.toLocaleString()}
                </span>
              )}
            </>
          }
          subtitle="Manage and track all incoming support requests"
        />

        {/* ── Type tabs ── */}
        <div className="flex flex-wrap items-center gap-2 mb-4" role="tablist" aria-label="Ticket type tabs">
          {([
            { value: "all",      label: "All"              },
            { value: "bug",      label: "Bugs & Support"   },
            { value: "impl",     label: "New Requirements" },
            { value: "reopened", label: "Reopened"         },
          ] as { value: TabFilter; label: string }[]).map((t) => {
            const active = tabFilter === t.value;
            return (
              <Button
                key={t.value}
                type="button"
                role="tab"
                aria-selected={active}
                variant={active ? "default" : "outline"}
                size="sm"
                onClick={() => { setTabFilter(t.value); setStatusFilter(""); }}
              >
                {t.label}
              </Button>
            );
          })}
        </div>

        {/* ── Filter bar ── */}
        <div className="flex flex-wrap items-center gap-2.5 mb-5">
          {/* Search */}
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 flex-1 min-w-[180px]"
            style={{ background: "var(--rt-surface)", border: "1px solid var(--rt-border)" }}
          >
            <Search className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "var(--rt-text-3)" }} />
            <input
              type="text"
              placeholder="Search tickets…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="bg-transparent text-xs outline-none w-full placeholder:opacity-50"
              style={{ color: "var(--rt-text-2)", caretColor: "var(--rt-accent)" }}
            />
            {searchInput && (
              <button onClick={() => setSearchInput("")}>
                <X className="h-3 w-3" style={{ color: "var(--rt-text-3)" }} />
              </button>
            )}
          </div>

          {/* Status filter — only show statuses visible in the ticket list.
              Disabled on the Reopened tab because the tab already forces status=REOPENED. */}
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter((v as string) === "all" ? "" : (v as StatusValue))}
            disabled={tabFilter === "reopened"}
          >
            <SelectTrigger
              className="h-8 text-xs rounded-lg px-3 border w-full sm:w-[140px]"
              style={{
                background: "var(--rt-surface)",
                border:     "1px solid var(--rt-border)",
                color:      statusFilter ? "var(--rt-text-2)" : "var(--rt-text-3)",
                boxShadow:  "none",
                opacity:    tabFilter === "reopened" ? 0.5 : 1,
                cursor:     tabFilter === "reopened" ? "not-allowed" : undefined,
              }}
            >
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All statuses</SelectItem>
              {/* Filter status options by active tab so impl-only statuses
                  don't appear on Bug & Support and vice versa. */}
              {(tabFilter === "bug"
                ? STATUSES.filter((s) => !["SUBMITTED", "ADMIN_REVIEW", "PLANNING", "CUSTOMER_APPROVAL", "APPROVED"].includes(s))
                : tabFilter === "impl"
                ? (["SUBMITTED", "ADMIN_REVIEW", "PLANNING", "CUSTOMER_APPROVAL", "APPROVED", "OPEN_IN_PROGRESS", "OPEN_DONE", "CLOSED"] as StatusValue[])
                : STATUSES
              ).map((s) => (
                <SelectItem key={s} value={s} className="text-xs">{STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Category filter — hidden when a type tab is active to avoid contradictory filters */}
          {tabFilter === "all" && (
            <Select
              value={typeFilter}
              onValueChange={(v) => setTypeFilter((v as string) === "all" ? "" : (v as TicketTypeValue))}
            >
              <SelectTrigger
                className="h-8 text-xs rounded-lg px-3 border w-full sm:w-[148px]"
                style={{
                  background: "var(--rt-surface)",
                  border:     "1px solid var(--rt-border)",
                  color:      typeFilter ? "var(--rt-text-2)" : "var(--rt-text-3)",
                  boxShadow:  "none",
                }}
              >
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All categories</SelectItem>
                {TICKET_TYPES.map((t) => (
                  <SelectItem key={t} value={t} className="text-xs">{CATEGORY_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Client filter */}
          <Select
            value={clientFilter}
            onValueChange={(v) => { setOrganizationFilter(""); setClientFilter(!v || v === "all" ? "" : v); }}
          >
            <SelectTrigger
              className="h-8 text-xs rounded-lg px-3 w-full sm:w-[160px]"
              style={{
                background: "var(--rt-surface)",
                border:     "1px solid var(--rt-border)",
                color:      clientFilter ? "var(--rt-text-2)" : "var(--rt-text-3)",
                boxShadow:  "none",
              }}
            >
              <span className="truncate">
                {clientFilter
                  ? (clientList.find((c) => c.id === clientFilter)?.name ?? "Loading…")
                  : organizationFilter ? "Company workspace" : "All clients"}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All clients</SelectItem>
              {clientList.map((c) => (
                <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Assignee filter */}
          <Select
            value={assigneeFilter}
            onValueChange={(v) => setAssigneeFilter(!v || v === "all" ? "" : v)}
          >
            <SelectTrigger
              className="h-8 text-xs rounded-lg px-3 w-full sm:w-[160px]"
              style={{
                background: "var(--rt-surface)",
                border:     "1px solid var(--rt-border)",
                color:      assigneeFilter ? "var(--rt-text-2)" : "var(--rt-text-3)",
                boxShadow:  "none",
              }}
            >
              <SelectValue placeholder="All assignees" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all"        className="text-xs">All assignees</SelectItem>
              <SelectItem value="unassigned" className="text-xs">Unassigned</SelectItem>
              {agentUsers.map((u) => (
                <SelectItem key={u.id} value={u.id} className="text-xs">{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div role="group" aria-label="Ticket creation date" className="flex flex-wrap gap-2">
            {([
              ["today", "Today"], ["previous", "Previous tickets"], ["all", "All time"], ["custom", "Date range"],
            ] as const).map(([value, label]) => (
              <Button key={value} type="button" size="sm" variant={dateView === value ? "default" : "outline"}
                aria-pressed={dateView === value} onClick={() => setDateView(value)}>
                {label}
              </Button>
            ))}
          </div>
          {dateView === "custom" && <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs" style={{ color: "var(--rt-text-3)" }}>From</span>
              <input
                type="date"
                aria-label="From date"
                max={dateTo || undefined}
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-8 text-xs rounded-lg px-2 outline-none"
                style={{
                  background: "var(--rt-surface)",
                  border:     "1px solid var(--rt-border)",
                  color:      "var(--rt-text-2)",
                }}
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs" style={{ color: "var(--rt-text-3)" }}>To</span>
              <input
                type="date"
                aria-label="To date"
                min={dateFrom || undefined}
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-8 text-xs rounded-lg px-2 outline-none"
                style={{
                  background: "var(--rt-surface)",
                  border:     "1px solid var(--rt-border)",
                  color:      "var(--rt-text-2)",
                }}
              />
            </div>
          </div>}

          {/* Sort control */}
          <div className="flex items-center gap-1.5">
            <Select value={sorting.id} onValueChange={changeSortField}>
              <SelectTrigger
                data-testid="sort-select-trigger"
                className="h-8 text-xs rounded-lg px-3 border w-full sm:w-[150px]"
                style={{
                  background: "var(--rt-surface)",
                  border:     "1px solid var(--rt-border)",
                  color:      "var(--rt-text-2)",
                  boxShadow:  "none",
                }}
              >
                <span className="truncate">
                  {SORT_FIELDS.find((f) => f.value === sorting.id)?.label ?? "Sort by"}
                </span>
              </SelectTrigger>
              <SelectContent>
                {SORT_FIELDS.map((f) => (
                  <SelectItem key={f.value} value={f.value} className="text-xs">{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="sort-direction-toggle"
              aria-label={sorting.desc ? "Sort descending" : "Sort ascending"}
              onClick={toggleSortDirection}
            >
              {sorting.desc ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
            </Button>
          </div>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 text-xs rounded-lg px-3 py-1.5 ml-auto transition-colors duration-150 text-[var(--rt-text-3)] bg-[var(--rt-surface)] border border-[var(--rt-border)] hover:text-destructive hover:border-destructive/25"
            >
              <X className="h-3 w-3" />
              Clear filters
            </button>
          )}
        </div>

        {/* ── Error state ── */}
        {isError && (
          <ErrorBanner message="Failed to load tickets. Please refresh the page." className="mb-4" />
        )}

        {/* ── Priority board ── */}
        {!isError && (
          <div className="overflow-x-auto pb-2 -mx-4 px-4 sm:-mx-6 sm:px-6 snap-x snap-mandatory sm:snap-none">
            <div className="flex gap-4">
              {columns.map((col) => (
                <PriorityColumn
                  key={col.priority}
                  priority={col.priority}
                  label={col.label}
                  q={col.q}
                  onQuickView={setSelectedTicket}
                  returnTo={returnTo}
                />
              ))}
            </div>
          </div>
        )}
    </div>

    <TicketSlidePanel ticket={selectedTicket} onClose={closePanel} returnTo={returnTo} />
    </>
  );
}

export default Tickets;
