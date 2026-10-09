"use client";

import { useActionState } from "react";
import { IconShield } from "@wedding/ui";
import {
  adminSignInAction,
  type AdminSignInState,
} from "../../lib/admin/actions";
import { Alert } from "../ui/alert";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

/**
 * `/masuk` — the real admin sign-in form (email + password only).
 *
 * The form posts to `adminSignInAction`, which normalizes and validates on the
 * server, proves the ADMIN membership, and creates the session before
 * redirecting. Every outcome shown here comes from the action's own state.
 */
export function AdminSignInForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState<
    AdminSignInState,
    FormData
  >(adminSignInAction, { status: "idle" });

  return (
    <main
      className="grid min-h-[100dvh] place-items-center bg-[var(--color-ivory)] px-4 py-8"
      aria-labelledby="admin-signin-title"
    >
      <section className="admin-state-card grid w-full max-w-md gap-5">
        <div className="admin-state-card__mark" aria-hidden="true">
          <IconShield className="size-5" />
        </div>
        <div className="grid gap-2">
          <p className="admin-eyebrow">Undangania operations</p>
          <h1
            id="admin-signin-title"
            className="text-2xl font-bold tracking-tight sm:text-3xl"
          >
            Masuk ke konsol admin
          </h1>
          <p className="text-sm leading-relaxed text-[var(--color-ink-soft)]">
            Gunakan email dan kata sandi akun admin untuk membuka konsol
            operasi.
          </p>
        </div>

        {state.status === "error" ? (
          <Alert variant="error" title="Tidak dapat masuk">
            {state.message}
          </Alert>
        ) : null}

        <form action={formAction} className="grid gap-4">
          <input type="hidden" name="next" value={next} />
          <label
            className="grid gap-1.5 text-xs font-bold text-[var(--color-ink-soft)]"
            htmlFor="admin-signin-email"
          >
            Email
            <Input
              id="admin-signin-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              placeholder="nama@undangania.id"
            />
          </label>
          <label
            className="grid gap-1.5 text-xs font-bold text-[var(--color-ink-soft)]"
            htmlFor="admin-signin-password"
          >
            Kata sandi
            <Input
              id="admin-signin-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={200}
              placeholder="Kata sandi akun admin"
            />
          </label>
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Memproses…" : "Masuk"}
          </Button>
        </form>

        <p className="text-xs leading-relaxed text-[var(--color-ink-soft)]">
          Akses konsol dicatat dalam jejak audit. Data sensitif ditampilkan
          dalam bentuk tersamarkan.
        </p>
      </section>
    </main>
  );
}
