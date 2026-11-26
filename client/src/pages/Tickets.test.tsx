import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TICKET_TYPE, PRIORITY, STATUS, type ApiTicket } from "@tms/core";
import Tickets from "./Tickets";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/auth-client", () => ({
  useSession: () => ({
    data: { user: { name: "Admin", role: "ADMIN" } },
    isPending: false,
  }),
  signOut: vi.fn(),
}));

vi.mock("axios");
import axios from "axios";
const mockedGet = vi.mocked(axios.get);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TICKET_1: ApiTicket = {
  id:          "id-1",
  ticketId:    "TKT-0042",
  title:       "Dashboard crashes on login",
  description: "From: Alice <alice@example.com>\n\nAfter logging in the dashboard throws a JS error.",
  type:        TICKET_TYPE.SUPPORT,
  priority:    PRIORITY.MEDIUM,
  status:      STATUS.OPEN_NOT_STARTED,
  project:     "Email Intake",
  assignedTo:  null,
  createdBy:   { id: "admin-id", name: "Admin" },
  createdAt:   "2026-04-01T10:00:00.000Z",
  updatedAt:   "2026-04-01T10:00:00.000Z",
  attachments: [],
};

const TICKET_2: ApiTicket = {
  ...TICKET_1,
  id:        "id-2",
  ticketId:  "TKT-0041",
  title:     "Older login issue",
  createdAt: "2026-04-01T09:00:00.000Z",
  updatedAt: "2026-04-01T09:00:00.000Z",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function renderTickets(queryClient = makeQueryClient()) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/tickets"]}>
        <Tickets />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function makePage(tickets: ApiTicket[]) {
  return { data: tickets, total: tickets.length, page: 1, pageSize: 10, totalPages: 1 };
}

function priorityFromUrl(url: string): string | null {
  return new URL(url, "http://localhost").searchParams.get("priority");
}

async function resolveWithTickets(tickets: ApiTicket[]) {
  // The component fires one query per priority column (Critical/High/Medium/Low),
  // plus the two filter-dropdown lookups. Bucket fixtures by their own `priority`
  // field so each column only sees the tickets that actually belong to it.
  mockedGet.mockImplementation((url: string) => {
    if (typeof url === "string" && url.includes("assignable-users")) {
      return Promise.resolve({ data: [] });
    }
    if (typeof url === "string" && url.includes("clients")) {
      return Promise.resolve({ data: [] });
    }
    const priority = priorityFromUrl(url);
    const matching = tickets.filter((t) => t.priority === priority);
    return Promise.resolve({ data: makePage(matching) });
  });
}

function findCardWithText(text: string) {
  const cards = screen.getAllByTestId("ticket-card");
  const card = cards.find((c: HTMLElement) => within(c).queryByText(text));
  if (!card) throw new Error(`No ticket card found containing "${text}"`);
  return card;
}

async function selectSortField(label: string) {
  await userEvent.click(screen.getByTestId("sort-select-trigger"));
  // The popup is portal-rendered and mounts before its open/close animation
  // settles, during which items report `pointer-events: none` — wait for that
  // to clear before clicking (a pre-existing base-ui Select timing quirk in
  // this codebase, not specific to this control).
  let item: HTMLElement | undefined;
  await waitFor(() => {
    const items = Array.from(document.querySelectorAll('[data-slot="select-item"]')) as HTMLElement[];
    item = items.find((i) => i.textContent?.trim() === label);
    if (!item) throw new Error(`Sort option "${label}" not found`);
    if (getComputedStyle(item).pointerEvents === "none") {
      throw new Error("select item not yet interactive");
    }
  });
  await userEvent.click(item!);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Tickets page — component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Page structure ────────────────────────────────────────────────────────

  it("renders the Tickets heading", async () => {
    await resolveWithTickets([TICKET_1]);
    renderTickets();
    expect(await screen.findByRole("heading", { name: "Tickets" })).toBeInTheDocument();
  });

  it("sort control defaults to Date Created", async () => {
    await resolveWithTickets([TICKET_1]);
    renderTickets();
    await screen.findAllByText("Dashboard crashes on login");
    expect(screen.getByTestId("sort-select-trigger")).toHaveTextContent("Date Created");
  });

  it("shows the ticket count in the stats chip — singular", async () => {
    await resolveWithTickets([TICKET_1]);
    renderTickets();
    expect(await screen.findByTestId("ticket-total-pill")).toHaveTextContent("1");
  });

  it("shows the ticket count in the stats chip — plural", async () => {
    await resolveWithTickets([TICKET_1, TICKET_2]);
    renderTickets();
    expect(await screen.findByTestId("ticket-total-pill")).toHaveTextContent("2");
  });

  it("ticket count in stats chip matches the number of rendered ticket cards", async () => {
    await resolveWithTickets([TICKET_1, TICKET_2]);
    renderTickets();
    await waitFor(() => expect(screen.getByTestId("ticket-total-pill")).toHaveTextContent("2"));

    const cards = screen.getAllByTestId("ticket-card");
    expect(cards.length).toBe(2);
  });

  // ─── Ticket data rendering ─────────────────────────────────────────────────

  it("displays the ticket card as a link to the ticket detail page", async () => {
    await resolveWithTickets([TICKET_1]);
    renderTickets();
    const card = await screen.findByTestId("ticket-card");
    expect(card).toHaveAttribute("href", "/tickets/TKT-0042");
    expect(within(card).getByText("Dashboard crashes on login")).toBeInTheDocument();
  });

  it("shows sender name on the ticket card", async () => {
    await resolveWithTickets([TICKET_1]);
    renderTickets();
    await screen.findAllByText("Dashboard crashes on login");
    const card = findCardWithText("Dashboard crashes on login");
    expect(within(card).getByText("Admin")).toBeInTheDocument();
  });

  it("shows project as subtitle on the ticket card", async () => {
    await resolveWithTickets([TICKET_1]);
    renderTickets();
    await screen.findAllByText("Dashboard crashes on login");
    const card = findCardWithText("Dashboard crashes on login");
    expect(within(card).getByText("Email Intake")).toBeInTheDocument();
  });

  it("shows Category as plain text with correct label: Support", async () => {
    await resolveWithTickets([TICKET_1]);
    renderTickets();
    await screen.findAllByText("Dashboard crashes on login");
    const card = findCardWithText("Dashboard crashes on login");
    expect(within(card).getByText("Support")).toBeInTheDocument();
  });

  it("shows Status badge with correct label: Not Started", async () => {
    await resolveWithTickets([TICKET_1]);
    renderTickets();
    await screen.findAllByText("Dashboard crashes on login");
    const card = findCardWithText("Dashboard crashes on login");
    expect(within(card).getByText("Not Started")).toBeInTheDocument();
  });

  // ─── Ordering ─────────────────────────────────────────────────────────────

  it("renders tickets in the order returned by the API (newest first)", async () => {
    await resolveWithTickets([TICKET_1, TICKET_2]);
    renderTickets();
    await screen.findAllByText("Dashboard crashes on login");

    const cards = screen.getAllByTestId("ticket-card");
    const cardTexts = cards.map((c: HTMLElement) => c.textContent ?? "");
    const idx1 = cardTexts.findIndex((t: string) => t.includes("Dashboard crashes on login"));
    const idx2 = cardTexts.findIndex((t: string) => t.includes("Older login issue"));
    expect(idx1).toBeLessThan(idx2);
  });

  // ─── Empty state ──────────────────────────────────────────────────────────

  it("shows empty state message when there are no tickets", async () => {
    await resolveWithTickets([]);
    renderTickets();
    const empties = await screen.findAllByText(/no (critical|high|medium|low) tickets/i);
    expect(empties).toHaveLength(4);
  });

  // ─── Board structure ──────────────────────────────────────────────────────

  it("renders 4 priority columns and no priority filter dropdown", async () => {
    await resolveWithTickets([TICKET_1]);
    renderTickets();
    await screen.findAllByText("Dashboard crashes on login");
    const columnLabels = screen.getAllByTestId("priority-column-label").map((el: HTMLElement) => el.textContent);
    expect(columnLabels).toEqual(["Critical", "High", "Medium", "Low"]);
    expect(screen.queryByText("All priorities")).not.toBeInTheDocument();
  });

  // ─── Error state ──────────────────────────────────────────────────────────

  it("shows error message when the API call fails", async () => {
    mockedGet.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("assignable-users")) {
        return Promise.resolve({ data: [] });
      }
      if (typeof url === "string" && url.includes("clients")) {
        return Promise.resolve({ data: [] });
      }
      return Promise.reject(new Error("Network error"));
    });
    renderTickets();
    expect(await screen.findByText(/failed to load tickets/i)).toBeInTheDocument();
  });

  // ─── Loading state ────────────────────────────────────────────────────────

  it("shows skeleton cards while loading (no ticket cards rendered yet)", () => {
    mockedGet.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("assignable-users")) {
        return Promise.resolve({ data: [] });
      }
      if (typeof url === "string" && url.includes("clients")) {
        return Promise.resolve({ data: [] });
      }
      return new Promise(() => {}); // never resolves — keeps the tickets query loading
    });
    renderTickets();
    expect(screen.getByRole("heading", { name: "Tickets" })).toBeInTheDocument();
    expect(screen.queryByTestId("ticket-card")).not.toBeInTheDocument();
  });
});

// ─── Sorting ──────────────────────────────────────────────────────────────────

describe("Tickets page — sorting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGet.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("assignable-users")) {
        return Promise.resolve({ data: [] });
      }
      if (typeof url === "string" && url.includes("clients")) {
        return Promise.resolve({ data: [] });
      }
      const priority = priorityFromUrl(url);
      const matching = priority === TICKET_1.priority ? [TICKET_1] : [];
      return Promise.resolve({ data: makePage(matching) });
    });
  });

  it("initial fetch sends sortBy=createdAt&sortOrder=desc", async () => {
    renderTickets();
    await screen.findAllByText("Dashboard crashes on login");
    expect(mockedGet).toHaveBeenCalledWith(
      expect.stringContaining("sortBy=createdAt&sortOrder=desc"),
      expect.any(Object)
    );
  });

  it("shows tickets created today by default and can switch to previous tickets", async () => {
    renderTickets();
    expect(screen.getByRole("button", { name: "Today", exact: true })).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith(
      expect.stringMatching(/[?&]from=.*&to=/), expect.any(Object),
    ));

    await userEvent.click(screen.getByRole("button", { name: "Previous tickets" }));
    expect(screen.getByRole("button", { name: "Previous tickets" })).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => {
      const [url] = mockedGet.mock.lastCall ?? [];
      const params = new URL(String(url), "http://localhost").searchParams;
      const now = new Date();
      const endOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, -1);
      expect(params.has("from")).toBe(false);
      expect(params.get("to")).toBe(endOfYesterday.toISOString());
    });
  });

  it("stats chip shows the ticket count by default (no filters active)", async () => {
    renderTickets();
    expect(await screen.findByTestId("ticket-total-pill")).toHaveTextContent("1");
  });

  it("selecting Status in the sort control sends sortBy=status (direction unchanged)", async () => {
    renderTickets();
    await screen.findAllByText("Dashboard crashes on login");

    await selectSortField("Status");

    await waitFor(() => {
      expect(mockedGet).toHaveBeenLastCalledWith(
        expect.stringContaining("sortBy=status&sortOrder=desc"),
        expect.any(Object)
      );
    });
  });

  it("toggling sort direction after selecting Status sends sortOrder=asc", async () => {
    renderTickets();
    await screen.findAllByText("Dashboard crashes on login");

    await selectSortField("Status");
    await waitFor(() =>
      expect(mockedGet).toHaveBeenLastCalledWith(
        expect.stringContaining("sortBy=status&sortOrder=desc"),
        expect.any(Object)
      )
    );

    await userEvent.click(screen.getByTestId("sort-direction-toggle"));
    await waitFor(() => {
      expect(mockedGet).toHaveBeenLastCalledWith(
        expect.stringContaining("sortBy=status&sortOrder=asc"),
        expect.any(Object)
      );
    });
  });
});
