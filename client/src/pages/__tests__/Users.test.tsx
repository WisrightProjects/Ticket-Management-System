import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import { describe, it, expect, beforeEach, vi } from "vitest";

import Users from "../Users";

vi.mock("axios");
vi.mock("@/components/Navbar", () => ({ default: () => <div>Navbar</div> }));
vi.mock("@/lib/auth-client", () => ({
  useSession: () => ({ data: { user: { name: "Admin", role: "ADMIN" } } }),
  signOut: vi.fn(),
}));

const mockedAxios = axios as any;

// Fresh QueryClient per test — prevents error state leaking between tests
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

describe("Users page", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("renders a list of users returned from the API", async () => {
    const users = [
      {
        id: "1",
        name: "Alice",
        email: "alice@example.com",
        role: "ADMIN",
        isActive: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: "2",
        name: "Bob",
        email: "bob@example.com",
        role: "AGENT",
        isActive: false,
        createdAt: new Date().toISOString(),
      },
    ];

    mockedAxios.get = vi.fn().mockResolvedValue({ data: users });

    render(
      <QueryClientProvider client={makeQueryClient()}>
        <MemoryRouter>
          <Users />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
    });
  });

  it("shows empty state when no users exist", async () => {
    mockedAxios.get = vi.fn().mockResolvedValue({ data: [] });

    render(
      <QueryClientProvider client={makeQueryClient()}>
        <MemoryRouter>
          <Users />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByText(/no users found/i)
      ).toBeInTheDocument();
    });
  });
});
