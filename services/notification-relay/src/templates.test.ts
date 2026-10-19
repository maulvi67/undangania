import { describe, expect, it } from "vitest";
import { NOTIFICATION_TEMPLATES } from "@wedding/notifications";
import {
  escapeHtml,
  renderTemplate,
  TemplateVariablesError,
  UnknownTemplateError,
} from "./templates";

describe("notification templates", () => {
  it("renders the email verification template", () => {
    const rendered = renderTemplate(NOTIFICATION_TEMPLATES.EMAIL_VERIFICATION, {
      actionUrl: "https://app.undangania.test/verifikasi?token=abc",
    });
    expect(rendered.subject).toContain("Verifikasi");
    expect(rendered.text).toContain(
      "https://app.undangania.test/verifikasi?token=abc",
    );
    expect(rendered.html).toContain("Verifikasi email");
  });

  it("renders the password reset template", () => {
    const rendered = renderTemplate(NOTIFICATION_TEMPLATES.PASSWORD_RESET, {
      actionUrl: "https://app.undangania.test/reset-sandi?token=abc",
    });
    expect(rendered.subject).toContain("Atur ulang");
    expect(rendered.text).toContain("1 jam");
  });

  it("renders the password changed template without variables", () => {
    const rendered = renderTemplate(
      NOTIFICATION_TEMPLATES.PASSWORD_CHANGED,
      {},
    );
    expect(rendered.subject).toContain("berhasil diubah");
    expect(rendered.html).toContain("Kata sandi");
  });

  it("renders the payment confirmation template", () => {
    const rendered = renderTemplate(NOTIFICATION_TEMPLATES.PAYMENT_CONFIRMED, {
      customerName: "Ani & Budi",
      orderNumber: "INV-2026-0001",
      status: "PAID",
      occurredAt: "2026-10-19T10:00:00.000Z",
    });
    expect(rendered.subject).toContain("INV-2026-0001");
    expect(rendered.text).toContain("Ani & Budi");
    expect(rendered.text).toContain("PAID");
  });

  it("escapes customer input in the HTML body", () => {
    const rendered = renderTemplate(NOTIFICATION_TEMPLATES.PAYMENT_CONFIRMED, {
      customerName: '<script>alert("x")</script>',
      orderNumber: "INV-1",
      status: "PAID",
      occurredAt: "2026-10-19",
    });
    expect(rendered.html).not.toContain("<script>");
    expect(rendered.html).toContain("&lt;script&gt;");
  });

  it("strips line breaks from the subject", () => {
    const rendered = renderTemplate(NOTIFICATION_TEMPLATES.PAYMENT_CONFIRMED, {
      customerName: "Ani",
      orderNumber: "INV-1\r\nBcc: attacker@example.com",
      status: "PAID",
      occurredAt: "2026-10-19",
    });
    expect(rendered.subject).not.toContain("\r");
    expect(rendered.subject).not.toContain("\n");
  });

  it("rejects an unknown template code", () => {
    expect(() => renderTemplate("auth.unknown-template", {})).toThrow(
      UnknownTemplateError,
    );
  });

  it("rejects a missing required variable", () => {
    expect(() =>
      renderTemplate(NOTIFICATION_TEMPLATES.EMAIL_VERIFICATION, {}),
    ).toThrow(TemplateVariablesError);
  });

  it("rejects a non-http action URL", () => {
    expect(() =>
      renderTemplate(NOTIFICATION_TEMPLATES.PASSWORD_RESET, {
        actionUrl: "javascript:alert(1)",
      }),
    ).toThrow(TemplateVariablesError);
  });

  it("escapes every HTML-sensitive character", () => {
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });
});
