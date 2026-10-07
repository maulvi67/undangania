"use client";

import { useMemo, useState } from "react";
import { CheckCheck, Inbox, Mail, MessageCircle, Send } from "lucide-react";
import { MESSAGES, type Message, type MessageChannel } from "../data";
import { usePrototype } from "../store";
import {
  EmptyState,
  PageHeader,
  ProtoButton,
  ProtoDialog,
  SegmentedControl,
  StatGrid,
  StatTile,
} from "../ui";

type InboxFilter = "semua" | "belum";

const CHANNEL_TONE: Record<MessageChannel, string> = {
  WhatsApp: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Email: "border-sky-200 bg-sky-50 text-sky-700",
  Instagram: "border-rose-200 bg-rose-50 text-rose-700",
};

/* -------------------------------------------------------------------------- */
/* Pesan Masuk                                                                 */
/* -------------------------------------------------------------------------- */

export function PesanMasukPage() {
  const { notify } = usePrototype();
  const [filter, setFilter] = useState<InboxFilter>("semua");
  const [read, setRead] = useState<readonly string[]>([]);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [draft, setDraft] = useState("");

  const isUnread = (message: Message) =>
    message.unread && !read.includes(message.id);

  const unreadCount = MESSAGES.filter(isUnread).length;

  const stats = useMemo(() => {
    let whatsapp = 0;
    let email = 0;
    for (const message of MESSAGES) {
      if (message.channel === "WhatsApp") whatsapp += 1;
      if (message.channel === "Email") email += 1;
    }
    return { whatsapp, email };
  }, []);

  const visible = useMemo(
    () =>
      filter === "belum"
        ? MESSAGES.filter(
            (message) => message.unread && !read.includes(message.id),
          )
        : MESSAGES,
    [filter, read],
  );

  const handleOpen = (message: Message) => {
    setRead((previous) =>
      previous.includes(message.id) ? previous : [...previous, message.id],
    );
  };

  const handleReply = () => {
    if (replyTo === null) return;
    notify(`Balasan untuk ${replyTo.customer} dikirim`);
    setReplyTo(null);
    setDraft("");
  };

  return (
    <div className="space-y-4 md:space-y-5">
      <PageHeader
        title="Pesan Masuk"
        description="Pertanyaan pelanggan dari WhatsApp, email, dan Instagram dalam satu kotak masuk."
        actions={
          <ProtoButton
            onClick={() => {
              setRead(MESSAGES.map((message) => message.id));
              notify("Semua pesan ditandai sudah dibaca");
            }}
          >
            <CheckCheck className="h-4 w-4" aria-hidden="true" />
            Tandai Dibaca
          </ProtoButton>
        }
      />

      <StatGrid>
        <StatTile
          label="Total Pesan"
          value={String(MESSAGES.length)}
          hint="Semua kanal"
          icon={<Inbox className="h-4 w-4" aria-hidden="true" />}
        />
        <StatTile
          label="Belum Dibalas"
          value={String(unreadCount)}
          hint="Perlu respons"
          tone="amber"
          icon={<MessageCircle className="h-4 w-4" aria-hidden="true" />}
        />
        <StatTile
          label="WhatsApp"
          value={String(stats.whatsapp)}
          hint="Kanal utama"
          tone="emerald"
          icon={<MessageCircle className="h-4 w-4" aria-hidden="true" />}
        />
        <StatTile
          label="Email"
          value={String(stats.email)}
          hint="Permintaan formal"
          tone="sky"
          icon={<Mail className="h-4 w-4" aria-hidden="true" />}
        />
      </StatGrid>

      <div className="rounded-[20px] border border-[var(--p-line)] bg-white p-4 shadow-[0_16px_44px_-32px_rgba(82,52,55,0.5)] md:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SegmentedControl
            ariaLabel="Filter kotak masuk"
            options={[
              { value: "semua", label: `Semua (${MESSAGES.length})` },
              { value: "belum", label: `Belum dibaca (${unreadCount})` },
            ]}
            value={filter}
            onChange={setFilter}
          />
          <p className="text-[11px] text-[var(--p-ink-soft)]">
            Pilih pesan untuk menandai sudah dibaca
          </p>
        </div>

        {visible.length === 0 ? (
          <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--p-line)]">
            <EmptyState
              icon={<Inbox className="h-5 w-5" aria-hidden="true" />}
              title="Kotak masuk bersih"
              description="Semua pesan pelanggan sudah dibalas."
              action={
                <ProtoButton size="sm" onClick={() => setFilter("semua")}>
                  Lihat semua pesan
                </ProtoButton>
              }
            />
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {visible.map((message) => {
              const unread = isUnread(message);
              return (
                <li key={message.id}>
                  <button
                    type="button"
                    onClick={() => handleOpen(message)}
                    className="flex w-full items-start gap-3 rounded-2xl border border-[var(--p-line)] p-4 text-left transition hover:bg-[var(--p-rose-soft)]/50 active:translate-y-px"
                  >
                    <span
                      aria-hidden="true"
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--p-rose-soft)] text-[11px] font-semibold text-[var(--p-rose-strong)]"
                    >
                      {initials(message.customer)}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-[13px] font-semibold text-[var(--p-ink)]">
                          {message.customer}
                        </span>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${CHANNEL_TONE[message.channel]}`}
                        >
                          {message.channel}
                        </span>
                        {unread ? (
                          <span
                            aria-label="Belum dibaca"
                            className="h-2 w-2 shrink-0 rounded-full bg-[var(--p-rose)]"
                          />
                        ) : null}
                      </span>
                      <span className="mt-1 block truncate text-[12px] font-semibold text-[var(--p-ink)]">
                        {message.subject}
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-relaxed text-[var(--p-ink-soft)]">
                        {message.preview}
                      </span>
                      <span className="proto-nums mt-1.5 block text-[10px] text-[var(--p-ink-soft)]">
                        {message.receivedAt}
                      </span>
                    </span>

                    <ProtoButton
                      size="sm"
                      className="shrink-0"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleOpen(message);
                        setReplyTo(message);
                      }}
                    >
                      <Send className="h-3.5 w-3.5" aria-hidden="true" />
                      Balas
                    </ProtoButton>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <ProtoDialog
        open={replyTo !== null}
        onClose={() => setReplyTo(null)}
        title={replyTo ? `Balas ${replyTo.customer}` : "Balas pesan"}
        description={
          replyTo ? `${replyTo.channel} · ${replyTo.subject}` : undefined
        }
        footer={
          <div className="flex flex-col gap-2 sm:flex-row">
            <ProtoButton className="flex-1" onClick={() => setReplyTo(null)}>
              Batal
            </ProtoButton>
            <ProtoButton
              className="flex-1"
              variant="primary"
              onClick={handleReply}
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              Kirim Balasan
            </ProtoButton>
          </div>
        }
      >
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="proto-reply"
            className="text-[11px] font-semibold text-[var(--p-ink-soft)]"
          >
            Isi balasan
          </label>
          <textarea
            id="proto-reply"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={4}
            placeholder="Tulis balasan untuk pelanggan..."
            className="w-full resize-none rounded-2xl border border-[var(--p-line)] bg-[var(--p-canvas)] p-3 text-[13px] text-[var(--p-ink)] outline-none placeholder:text-[var(--p-ink-soft)]/70 focus:border-[var(--p-rose)]"
          />
          <p className="text-[11px] text-[var(--p-ink-soft)]">
            Balasan dikirim melalui{" "}
            {replyTo ? replyTo.channel : "kanal yang dipilih"}.
          </p>
        </div>
      </ProtoDialog>
    </div>
  );
}

/** "Budi Santoso" -> "BS" */
function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}
