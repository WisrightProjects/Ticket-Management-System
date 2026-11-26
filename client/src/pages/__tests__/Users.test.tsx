import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axios from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Users from "../Users";

vi.mock("axios");
const get = vi.mocked(axios.get);

function employee(id: number) {
  return { id: String(id), name: `Employee ${id}`, email: `employee${id}@example.com`, role: "AGENT", isActive: true, createdAt: "2026-01-01T00:00:00Z" };
}

function renderUsers() {
  render(<QueryClientProvider client={new QueryClient()}><Users /></QueryClientProvider>);
}

describe("WiseWork employee directory", () => {
  beforeEach(() => vi.resetAllMocks());

  it("loads only the WiseWork employee scope and displays a read-only directory", async () => {
    get.mockResolvedValue({ data: [employee(1)], headers: { "x-employee-directory-source": "local-snapshot" } });
    renderUsers();
    expect(await screen.findByText("Employee 1")).toBeVisible();
    expect(screen.getByText(/snapshot of active WisRight employees/)).toBeVisible();
    expect(get).toHaveBeenCalledWith(expect.stringContaining("/api/users"), {
      params: { scope: "active-employees" }, withCredentials: true,
    });
    expect(screen.queryByRole("button", { name: /add user|right tracker accounts|edit|deactivate/i })).not.toBeInTheDocument();
  });

  it("supports numbered pages, page size and employee search", async () => {
    const user = userEvent.setup();
    get.mockResolvedValue({ data: Array.from({ length: 12 }, (_, index) => employee(index + 1)) });
    renderUsers();
    await user.click(await screen.findByRole("button", { name: "Page 2" }));
    expect(screen.getAllByTestId("user-card")).toHaveLength(2);
    await user.selectOptions(screen.getByLabelText("Rows per page"), "25");
    expect(screen.getAllByTestId("user-card")).toHaveLength(12);
    await user.type(screen.getByRole("textbox", { name: "Search employees" }), "employee12@");
    expect(screen.getAllByTestId("user-card")).toHaveLength(1);
    expect(screen.getByText("Employee 12")).toBeVisible();
  });

  it("shows an empty message for an empty directory", async () => {
    get.mockResolvedValue({ data: [] });
    renderUsers();
    expect(await screen.findByText("No active WiseWork employees found.")).toBeVisible();
  });

  it("shows when the WiseWork directory is unavailable", async () => {
    get.mockRejectedValue(new Error("Directory unavailable"));
    renderUsers();
    expect(await screen.findByText("The WiseWork employee directory is unavailable.")).toBeVisible();
  });
});
