import { describe, expect, it } from "vitest";
import { DEFAULT_REDIRECT, safeRedirectTarget, signInHref } from "./redirect";

describe("safeRedirectTarget", () => {
  it("returns the default for missing/empty values", () => {
    expect(safeRedirectTarget(undefined)).toBe(DEFAULT_REDIRECT);
    expect(safeRedirectTarget(null)).toBe(DEFAULT_REDIRECT);
    expect(safeRedirectTarget("")).toBe(DEFAULT_REDIRECT);
    expect(safeRedirectTarget("   ")).toBe(DEFAULT_REDIRECT);
  });

  it("accepts allowlisted internal paths, preserving in-app query params", () => {
    expect(safeRedirectTarget("/templates")).toBe("/templates");
    expect(safeRedirectTarget("/templates?q=nara")).toBe("/templates?q=nara");
    expect(safeRedirectTarget("/templates/seruni-klasik")).toBe("/templates/seruni-klasik");
    expect(safeRedirectTarget("/")).toBe("/");
  });

  it("rejects absolute and protocol-relative URLs", () => {
    expect(safeRedirectTarget("https://evil.example.com")).toBe(DEFAULT_REDIRECT);
    expect(safeRedirectTarget("//evil.example.com")).toBe(DEFAULT_REDIRECT);
    expect(safeRedirectTarget("/\\evil.example.com")).toBe(DEFAULT_REDIRECT);
    expect(safeRedirectTarget("http://localhost:3000/templates")).toBe(DEFAULT_REDIRECT);
  });

  it("rejects backslash and control-character smuggling", () => {
    expect(safeRedirectTarget("/templates\\..\\@evil")).toBe(DEFAULT_REDIRECT);
    expect(safeRedirectTarget("/templates\u0000.evil")).toBe(DEFAULT_REDIRECT);
    expect(safeRedirectTarget("/\t//evil.example.com")).toBe(DEFAULT_REDIRECT);
    expect(safeRedirectTarget("/ templates")).toBe(DEFAULT_REDIRECT);
  });

  it("rejects scheme-relative and encoded-host bypasses", () => {
    expect(safeRedirectTarget("https:evil.example.com")).toBe(DEFAULT_REDIRECT);
    expect(safeRedirectTarget(":///evil")).toBe(DEFAULT_REDIRECT);
    expect(safeRedirectTarget("/%2F%2Fevil.example.com")).toBe(DEFAULT_REDIRECT);
    expect(safeRedirectTarget("/templates/%2F%2Fevil")).toBe(DEFAULT_REDIRECT);
    expect(safeRedirectTarget("/\\t//evil")).toBe(DEFAULT_REDIRECT);
  });

  it("rejects non-allowlisted internal paths silently", () => {
    expect(safeRedirectTarget("/admin")).toBe(DEFAULT_REDIRECT);
    expect(safeRedirectTarget("/api/auth")).toBe(DEFAULT_REDIRECT);
    expect(safeRedirectTarget("javascript:alert(1)")).toBe(DEFAULT_REDIRECT);
  });

  it("drops credentials and fragments while keeping the validated path", () => {
    expect(safeRedirectTarget("/templates#fragment")).toBe("/templates");
    expect(safeRedirectTarget("/templates?q=1&x=2")).toBe("/templates?q=1&x=2");
  });
});

describe("signInHref", () => {
  it("omits the param for default destinations", () => {
    expect(signInHref(undefined)).toBe("/masuk");
    expect(signInHref("/")).toBe("/masuk");
    expect(signInHref("https://evil.example.com")).toBe("/masuk");
  });

  it("encodes safe destinations into the next param", () => {
    expect(signInHref("/templates?q=nara")).toBe("/masuk?next=%2Ftemplates%3Fq%3Dnara");
  });
});
