import { NOTIFICATION_TEMPLATES } from "@wedding/notifications";

/**
 * Email rendering for the notification relay.
 *
 * The relay owns the bodies: `@wedding/notifications` sends only a stable
 * template code and its variables. Copy lives here so a wording change does not
 * require a deployment of any calling service, and the codes are imported from
 * the contract package so the two cannot drift.
 */

export class UnknownTemplateError extends Error {
  public constructor(templateCode: string) {
    super(`Unknown notification template: ${templateCode}`);
    this.name = "UnknownTemplateError";
  }
}

export class TemplateVariablesError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "TemplateVariablesError";
  }
}

export type RenderedEmail = Readonly<{
  subject: string;
  text: string;
  html: string;
}>;

const TEMPLATE_CODES = new Set<string>(Object.values(NOTIFICATION_TEMPLATES));

export function renderTemplate(
  templateCode: string,
  variables: Readonly<Record<string, string>>,
): RenderedEmail {
  if (!TEMPLATE_CODES.has(templateCode)) {
    throw new UnknownTemplateError(templateCode);
  }

  switch (templateCode) {
    case NOTIFICATION_TEMPLATES.EMAIL_VERIFICATION: {
      const actionUrl = requireHttpUrl(variables, "actionUrl");
      return {
        subject: "Verifikasi email Undangania",
        text: [
          "Halo,",
          "",
          "Terima kasih sudah mendaftar di Undangania.",
          "",
          "Buka tautan berikut untuk memverifikasi alamat email Anda:",
          actionUrl,
          "",
          "Tautan berlaku selama 24 jam. Jika Anda tidak membuat akun ini, abaikan email ini.",
        ].join("\n"),
        html: layout({
          heading: "Verifikasi email Anda",
          body: "<p>Terima kasih sudah mendaftar di Undangania.</p><p>Klik tombol di bawah untuk memverifikasi alamat email Anda.</p>",
          actionUrl,
          actionLabel: "Verifikasi email",
          footnote:
            "Tautan berlaku selama 24 jam. Jika Anda tidak membuat akun ini, abaikan email ini.",
        }),
      };
    }

    case NOTIFICATION_TEMPLATES.PASSWORD_RESET: {
      const actionUrl = requireHttpUrl(variables, "actionUrl");
      return {
        subject: "Atur ulang kata sandi Undangania",
        text: [
          "Halo,",
          "",
          "Kami menerima permintaan untuk mengatur ulang kata sandi akun Anda.",
          "",
          "Buka tautan berikut untuk membuat kata sandi baru:",
          actionUrl,
          "",
          "Tautan berlaku selama 1 jam. Jika Anda tidak meminta ini, abaikan email ini; kata sandi Anda tidak berubah.",
        ].join("\n"),
        html: layout({
          heading: "Atur ulang kata sandi",
          body: "<p>Kami menerima permintaan untuk mengatur ulang kata sandi akun Anda.</p>",
          actionUrl,
          actionLabel: "Buat kata sandi baru",
          footnote:
            "Tautan berlaku selama 1 jam. Jika Anda tidak meminta ini, abaikan email ini; kata sandi Anda tidak berubah.",
        }),
      };
    }

    case NOTIFICATION_TEMPLATES.PASSWORD_CHANGED:
      return {
        subject: "Kata sandi Undangania berhasil diubah",
        text: [
          "Halo,",
          "",
          "Kata sandi akun Anda baru saja diubah.",
          "",
          "Jika Anda melakukan perubahan ini, tidak ada tindakan lain yang diperlukan.",
          "Jika bukan Anda, segera atur ulang kata sandi dan hubungi dukungan Undangania.",
        ].join("\n"),
        html: layout({
          heading: "Kata sandi berhasil diubah",
          body: "<p>Kata sandi akun Anda baru saja diubah.</p><p>Jika Anda melakukan perubahan ini, tidak ada tindakan lain yang diperlukan.</p><p>Jika bukan Anda, segera atur ulang kata sandi dan hubungi dukungan Undangania.</p>",
          footnote: "Email ini dikirim otomatis. Jangan balas email ini.",
        }),
      };

    case NOTIFICATION_TEMPLATES.PAYMENT_CONFIRMED: {
      const customerName = requireVariable(variables, "customerName");
      const orderNumber = requireVariable(variables, "orderNumber");
      const status = requireVariable(variables, "status");
      const occurredAt = requireVariable(variables, "occurredAt");
      const safeCustomerName = singleLine(customerName);
      const safeOrderNumber = singleLine(orderNumber);
      const safeStatus = singleLine(status);
      const safeOccurredAt = singleLine(occurredAt);

      return {
        subject: `Pembayaran pesanan ${safeOrderNumber} diterima`,
        text: [
          `Halo ${safeCustomerName},`,
          "",
          `Pembayaran untuk pesanan ${safeOrderNumber} telah diterima.`,
          "",
          `Status: ${safeStatus}`,
          `Waktu: ${safeOccurredAt}`,
          "",
          "Undangan Anda sekarang dapat diterbitkan dari dasbor Undangania.",
        ].join("\n"),
        html: layout({
          heading: "Pembayaran diterima",
          body: [
            `<p>Halo ${escapeHtml(safeCustomerName)},</p>`,
            `<p>Pembayaran untuk pesanan <strong>${escapeHtml(safeOrderNumber)}</strong> telah diterima.</p>`,
            `<p>Status: <strong>${escapeHtml(safeStatus)}</strong><br />Waktu: ${escapeHtml(safeOccurredAt)}</p>`,
            "<p>Undangan Anda sekarang dapat diterbitkan dari dasbor Undangania.</p>",
          ].join(""),
          footnote: "Email ini dikirim otomatis. Jangan balas email ini.",
        }),
      };
    }

    default:
      // The set membership check above narrows this branch away at runtime, but
      // TypeScript cannot prove it, and failing loudly is safer than returning
      // an empty message.
      throw new UnknownTemplateError(templateCode);
  }
}

function requireVariable(
  variables: Readonly<Record<string, string>>,
  name: string,
): string {
  const value = variables[name];
  if (value === undefined || value.trim().length === 0) {
    throw new TemplateVariablesError(`Template variable is required: ${name}`);
  }
  return value;
}

function requireHttpUrl(
  variables: Readonly<Record<string, string>>,
  name: string,
): string {
  const value = requireVariable(variables, name);
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new TemplateVariablesError(
      `Template variable must be a URL: ${name}`,
    );
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new TemplateVariablesError(
      `Template variable must use http or https: ${name}`,
    );
  }
  return value;
}

/**
 * Removes line breaks from a value that reaches a subject or plain-text body.
 * Nodemailer encodes headers, but a header value assembled from customer input
 * should not rely on that.
 */
export function singleLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

type LayoutInput = Readonly<{
  heading: string;
  body: string;
  actionUrl?: string;
  actionLabel?: string;
  footnote: string;
}>;

function layout(input: LayoutInput): string {
  const button =
    input.actionUrl === undefined
      ? ""
      : `<p style="margin:28px 0"><a href="${escapeHtml(input.actionUrl)}" style="display:inline-block;padding:14px 24px;border-radius:9999px;background:#1f2937;color:#ffffff;text-decoration:none;font-weight:600">${escapeHtml(input.actionLabel ?? "Buka")}</a></p>`;
  return [
    '<!doctype html><html lang="id"><body style="margin:0;padding:32px 16px;background:#f5f2ec;font-family:Georgia,\'Times New Roman\',serif;color:#1f2937">',
    '<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;padding:40px 32px">',
    `<h1 style="margin:0 0 20px;font-size:24px;line-height:1.3">${escapeHtml(input.heading)}</h1>`,
    `<div style="font-size:16px;line-height:1.7">${input.body}</div>`,
    button,
    `<p style="margin:28px 0 0;font-size:13px;line-height:1.6;color:#6b7280">${escapeHtml(input.footnote)}</p>`,
    "</div></body></html>",
  ].join("");
}
