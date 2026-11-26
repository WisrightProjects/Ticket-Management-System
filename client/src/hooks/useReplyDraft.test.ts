import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { clearStaffDrafts, useReplyDraft } from "./useReplyDraft";

beforeEach(() => sessionStorage.clear());
describe("Scoped reply drafts", () => {
  it("isolates public/internal drafts and restores them after remount", () => {
    const first = renderHook(() => useReplyDraft("agent-a", "TKT-1"));
    act(() => first.result.current.set("public", "Customer-safe reply"));
    act(() => first.result.current.set("internal", "Private investigation"));
    first.unmount();
    const next = renderHook(() => useReplyDraft("agent-a", "TKT-1"));
    expect(next.result.current.get("public")).toBe("Customer-safe reply");
    expect(next.result.current.get("internal")).toBe("Private investigation");
  });
  it("does not show another user's or ticket's text", () => {
    const { result, rerender } = renderHook(({ owner, ticket }: { owner: string; ticket: string }) => useReplyDraft(owner, ticket), { initialProps: { owner: "agent-a", ticket: "TKT-1" } });
    act(() => result.current.set("internal", "Private note"));
    rerender({ owner: "agent-b", ticket: "TKT-1" });
    expect(result.current.get("internal")).toBe("");
    rerender({ owner: "agent-a", ticket: "TKT-2" });
    expect(result.current.get("internal")).toBe("");
  });
  it("clears only the successfully sent version and keeps later edits", () => {
    const { result } = renderHook(() => useReplyDraft("agent-a", "TKT-1"));
    act(() => result.current.set("public", "Original"));
    act(() => result.current.set("public", "Newer edit"));
    act(() => result.current.clearSent("public", "Original"));
    expect(result.current.get("public")).toBe("Newer edit");
    act(() => result.current.clearSent("public", "Newer edit"));
    expect(result.current.get("public")).toBe("");
  });
  it("clears staff drafts on sign-out without clearing unrelated storage", () => {
    const { result, unmount } = renderHook(() => useReplyDraft("agent-a", "TKT-1"));
    act(() => result.current.set("public", "Unsent"));
    sessionStorage.setItem("unrelated", "keep");
    unmount();
    clearStaffDrafts();
    const next = renderHook(() => useReplyDraft("agent-a", "TKT-1"));
    expect(next.result.current.get("public")).toBe("");
    expect(sessionStorage.getItem("unrelated")).toBe("keep");
  });
});
