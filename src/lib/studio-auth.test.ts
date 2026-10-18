import { describe, it, expect, vi, beforeEach } from "vitest";

const getServerSession = vi.fn();
vi.mock("next-auth", () => ({ getServerSession: () => getServerSession() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

import {
  requireAuth,
  requireStudioAccess,
  requireEditorAccess,
  requireAdminAccess,
} from "./studio-auth";

function asRole(role: string) {
  getServerSession.mockResolvedValue({ user: { id: "u1", role, email: "x@y.z" } });
}

describe("studio auth guards", () => {
  beforeEach(() => getServerSession.mockReset());

  it("rejects anonymous callers everywhere", async () => {
    getServerSession.mockResolvedValue(null);
    await expect(requireAuth()).rejects.toThrow();
    await expect(requireStudioAccess()).rejects.toThrow();
    await expect(requireEditorAccess()).rejects.toThrow();
    await expect(requireAdminAccess()).rejects.toThrow();
  });

  it("keeps students out of the studio (no auto-promotion)", async () => {
    asRole("student");
    await expect(requireAuth()).resolves.toBe("u1");
    await expect(requireStudioAccess()).rejects.toThrow();
    await expect(requireEditorAccess()).rejects.toThrow();
    await expect(requireAdminAccess()).rejects.toThrow();
  });

  it("lets reviewers in but not edit content", async () => {
    asRole("reviewer");
    await expect(requireStudioAccess()).resolves.toBe("u1");
    await expect(requireEditorAccess()).rejects.toThrow();
    await expect(requireAdminAccess()).rejects.toThrow();
  });

  it("lets editors edit content but not administer", async () => {
    asRole("editor");
    await expect(requireStudioAccess()).resolves.toBe("u1");
    await expect(requireEditorAccess()).resolves.toBe("u1");
    await expect(requireAdminAccess()).rejects.toThrow();
  });

  it("lets admins do everything", async () => {
    asRole("admin");
    await expect(requireStudioAccess()).resolves.toBe("u1");
    await expect(requireEditorAccess()).resolves.toBe("u1");
    await expect(requireAdminAccess()).resolves.toBe("u1");
  });
});
