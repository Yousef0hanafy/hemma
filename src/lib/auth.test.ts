import { describe, it, expect } from "vitest";
import { hasPermission } from "./auth";

describe("RBAC Permissions", () => {
  it("grants student permission to read and create attempts", () => {
    expect(hasPermission("student", "attempt", "create")).toBe(true);
    expect(hasPermission("student", "attempt", "read")).toBe(true);
  });

  it("grants student permission to create and read favorites", () => {
    expect(hasPermission("student", "favorite", "create")).toBe(true);
    expect(hasPermission("student", "favorite", "read")).toBe(true);
  });

  it("grants student permission to create and read reviews for SRS", () => {
    expect(hasPermission("student", "review", "create")).toBe(true);
    expect(hasPermission("student", "review", "read")).toBe(true);
  });

  it("grants student permission to read weekly challenges", () => {
    expect(hasPermission("student", "challenge", "read")).toBe(true);
  });

  it("denies student permission to create questions or modify sources", () => {
    expect(hasPermission("student", "question", "create")).toBe(false);
    expect(hasPermission("student", "source", "delete")).toBe(false);
  });

  it("grants admin full wildcard permissions", () => {
    expect(hasPermission("admin", "anything", "delete")).toBe(true);
    expect(hasPermission("admin", "question", "create")).toBe(true);
  });
});
