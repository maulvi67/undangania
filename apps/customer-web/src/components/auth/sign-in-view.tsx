"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Heart,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { signInAction } from "../../lib/auth/actions";
import {
  AUTH_ERROR_MESSAGES,
  INITIAL_AUTH_FORM_STATE,
  type AuthFormState,
} from "../../lib/auth/contract";

/**
 * `/masuk` — the real sign-in form.
 *
 * The form posts to `signInAction`, which normalizes and validates on the
 * server and creates the session before redirecting to `next`. Everything the
 * page shows about the outcome comes from the action's own state machine; there
 * is no simulated success path.
 */

/** Cubic-bezier easing untuk animasi masuk. */
const ease: [number, number, number, number] = [0.22, 1, 0.36, 1];

const featureItems = [
  "Kelola undangan dalam satu dashboard",
  "Pantau RSVP dan buku tamu",
  "Edit konten kapan saja",
];

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path
        fill="#4285F4"
        d="M21.35 12.23c0-.71-.06-1.24-.2-1.79H12v3.26h5.37a4.7 4.7 0 0 1-2 3.04l-.02.11 2.9 2.25.2.02c1.84-1.69 2.9-4.19 2.9-6.89Z"
      />
      <path
        fill="#34A853"
        d="M12 21.75c2.62 0 4.82-.86 6.43-2.63l-3.07-2.38c-.82.55-1.92.94-3.36.94a5.83 5.83 0 0 1-5.52-4.03l-.1.01-3.02 2.34-.03.1A9.7 9.7 0 0 0 12 21.75Z"
      />
      <path
        fill="#FBBC05"
        d="M6.48 13.65A5.98 5.98 0 0 1 6.16 12c0-.57.11-1.12.3-1.65v-.11L3.4 7.87l-.1.05A9.75 9.75 0 0 0 2.25 12c0 1.47.38 2.85 1.08 4.08l3.15-2.43Z"
      />
      <path
        fill="#EA4335"
        d="M12 6.32c1.83 0 3.07.79 3.78 1.44l2.72-2.65A9.27 9.27 0 0 0 12 2.25a9.7 9.7 0 0 0-8.67 5.67l3.13 2.43A5.85 5.85 0 0 1 12 6.32Z"
      />
    </svg>
  );
}

interface LogoProps {
  light?: boolean;
}

function Logo({ light = false }: LogoProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-[#e5a1ab] to-[#933744] text-white shadow-[0_12px_30px_rgba(147,55,68,.28)]">
        <Heart className="h-5 w-5" />
      </div>
      <div>
        <div
          className={`font-serif text-xl font-bold leading-none ${light ? "text-white" : "text-slate-900"}`}
        >
          Undangania
        </div>
        <div
          className={`mt-1 text-[9px] tracking-[.13em] ${light ? "text-white/45" : "text-slate-500"}`}
        >
          UNDANGAN DIGITAL, CERITA ABADI
        </div>
      </div>
    </div>
  );
}

interface RippleButtonProps {
  children: ReactNode;
  className?: string;
  rippleClassName?: string;
  disabled?: boolean;
  type?: "button" | "submit";
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
}

interface Ripple {
  id: string;
  x: number;
  y: number;
  size: number;
}

function RippleButton({
  children,
  className = "",
  rippleClassName = "bg-white/30",
  onClick,
  disabled = false,
  type = "button",
}: RippleButtonProps) {
  const reduceMotion = useReducedMotion();
  const [ripples, setRipples] = useState<Ripple[]>([]);

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (!disabled && !reduceMotion) {
      const rect = event.currentTarget.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 2;
      const ripple: Ripple = {
        id: `${Date.now()}-${Math.random()}`,
        x: event.clientX - rect.left - size / 2,
        y: event.clientY - rect.top - size / 2,
        size,
      };
      setRipples((items) => [...items, ripple]);
      window.setTimeout(() => {
        setRipples((items) => items.filter((item) => item.id !== ripple.id));
      }, 650);
    }
    onClick?.(event);
  };

  const motionDisabled = disabled || reduceMotion === true;

  return (
    <motion.button
      type={type}
      disabled={disabled}
      onClick={handleClick}
      whileHover={motionDisabled ? {} : { y: -2, scale: 1.008 }}
      whileTap={motionDisabled ? {} : { y: 0, scale: 0.975 }}
      transition={{ type: "spring", stiffness: 420, damping: 25 }}
      className={`group relative isolate overflow-hidden disabled:pointer-events-none disabled:opacity-60 ${className}`}
    >
      <span className="relative z-10 inline-flex items-center justify-center gap-2">
        {children}
      </span>
      <span aria-hidden="true" className="pointer-events-none absolute inset-0">
        <AnimatePresence>
          {ripples.map((ripple) => (
            <motion.span
              key={ripple.id}
              initial={{ scale: 0, opacity: 0.42 }}
              animate={{ scale: 1, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease }}
              className={`absolute rounded-full ${rippleClassName}`}
              style={{
                left: ripple.x,
                top: ripple.y,
                width: ripple.size,
                height: ripple.size,
              }}
            />
          ))}
        </AnimatePresence>
      </span>
    </motion.button>
  );
}

interface FormFieldProps {
  label: string;
  icon: LucideIcon;
  error?: string | undefined;
  children: ReactNode;
}

function FormField({ label, icon: Icon, error, children }: FormFieldProps) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-slate-700">{label}</span>
      <div
        className={`mt-2 flex h-12 items-center rounded-xl border bg-white transition duration-300 focus-within:ring-4 ${
          error
            ? "border-rose-400 focus-within:border-rose-500 focus-within:ring-rose-100"
            : "border-[#e3d8d2] focus-within:border-[#b85a68] focus-within:ring-[#b95363]/10"
        }`}
      >
        <Icon className="ml-3 h-4 w-4 shrink-0 text-slate-400" />
        {children}
      </div>
      <AnimatePresence initial={false}>
        {error ? (
          <motion.span
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="mt-1.5 block text-xs text-rose-600"
          >
            {error}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </label>
  );
}

/** Form-level copy for the current state; field errors carry the specifics. */
function formLevelMessage(state: AuthFormState): string {
  if (state.status !== "error" || !state.code) return "";
  return AUTH_ERROR_MESSAGES[state.code];
}

interface SignInViewProps {
  /** Server-validated redirect target. */
  next: string;
  oauthError?: "failed" | "unavailable" | undefined;
}

export function SignInView({ next, oauthError }: SignInViewProps) {
  const reduceMotion = useReducedMotion();
  const [state, formAction, pending] = useActionState(
    signInAction,
    INITIAL_AUTH_FORM_STATE,
  );
  const [showPassword, setShowPassword] = useState(false);
  const alertRef = useRef<HTMLDivElement>(null);
  const suspendedHeadingRef = useRef<HTMLHeadingElement>(null);

  const withNext = (path: string) =>
    next && next !== "/" ? `${path}?next=${encodeURIComponent(next)}` : path;

  useEffect(() => {
    if (state === INITIAL_AUTH_FORM_STATE) return;
    if (state.code === "SUSPENDED") {
      suspendedHeadingRef.current?.focus();
      return;
    }
    if (state.status === "error") alertRef.current?.focus();
  }, [state]);

  const oauthMessage =
    oauthError === "failed"
      ? "Masuk dengan Google belum berhasil. Coba lagi atau gunakan email dan kata sandi."
      : oauthError === "unavailable"
        ? "Masuk dengan Google sedang tidak tersedia. Gunakan email dan kata sandi atau coba lagi nanti."
        : "";
  const visibleError = formLevelMessage(state) || oauthMessage;

  const suspended = state.code === "SUSPENDED";

  return (
    <div className="min-h-screen bg-[#fbf8f5] text-slate-900">
      <div className="grid min-h-screen lg:grid-cols-[1.04fr_.96fr]">
        <section className="relative hidden overflow-hidden bg-[#19131a] p-10 text-white lg:flex lg:flex-col xl:p-14">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(201,104,120,.46),transparent_32%),radial-gradient(circle_at_82%_12%,rgba(214,169,108,.24),transparent_30%),linear-gradient(140deg,#171219_5%,#39222c_52%,#171218_100%)]" />
          <motion.div
            animate={reduceMotion ? {} : { x: [-20, 36, -20], y: [10, -24, 10] }}
            transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -left-20 top-32 h-96 w-96 rounded-full bg-[#af4959]/20 blur-3xl will-change-transform"
          />
          <motion.div
            animate={reduceMotion ? {} : { x: [20, -30, 20], y: [-10, 30, -10] }}
            transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -right-20 top-10 h-[28rem] w-[28rem] rounded-full bg-[#d6a96c]/14 blur-3xl will-change-transform"
          />
          <div
            className="absolute inset-0 opacity-[.08]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,.13) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.13) 1px,transparent 1px)",
              backgroundSize: "54px 54px",
            }}
          />

          <div className="relative z-10">
            <Logo light />
          </div>
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease }}
            className="relative z-10 my-auto max-w-xl"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-bold text-[#efc78e] backdrop-blur">
              <Sparkles className="h-4 w-4" /> Kembali ke cerita istimewa Anda
            </div>
            <h1 className="mt-7 font-serif text-5xl font-bold leading-[1.08] xl:text-6xl">
              Kelola undangan digital dengan lebih{" "}
              <span className="bg-gradient-to-r from-[#f3bac3] to-[#efc78e] bg-clip-text text-transparent">
                mudah dan elegan.
              </span>
            </h1>
            <p className="mt-6 max-w-lg text-base leading-8 text-white/58">
              Masuk untuk melanjutkan pengaturan, melihat respons tamu, dan
              membagikan undangan Anda.
            </p>
            <div className="mt-9 space-y-4">
              {featureItems.map((item, index) => (
                <motion.div
                  key={item}
                  initial={{ opacity: 0, x: -18 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 + index * 0.1, duration: 0.55, ease }}
                  className="flex items-center gap-3 text-sm text-white/70"
                >
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-400/15 text-emerald-300">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  {item}
                </motion.div>
              ))}
            </div>
          </motion.div>
          <div className="relative z-10 flex items-center gap-2 text-xs text-white/35">
            <ShieldCheck className="h-4 w-4" /> Autentikasi aman untuk akun
            Undangania
          </div>
        </section>

        <section className="relative flex min-h-screen items-center justify-center px-4 py-8 sm:px-8 lg:px-12">
          <div className="absolute left-4 top-5 lg:hidden">
            <Logo />
          </div>
          <Link
            href="/"
            className="absolute right-4 top-5 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-slate-500 transition hover:bg-white hover:text-[#a54150] sm:right-8"
          >
            <ArrowLeft className="h-4 w-4" /> Kembali
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.72, ease }}
            className="mt-16 w-full max-w-md lg:mt-0"
          >
            <div className="rounded-[30px] border border-white/80 bg-white/88 p-5 shadow-[0_30px_90px_rgba(74,48,51,.12)] backdrop-blur-xl sm:p-8">
              {suspended ? (
                <>
                  <h2
                    className="font-serif text-3xl font-bold focus:outline-none"
                    tabIndex={-1}
                    ref={suspendedHeadingRef}
                  >
                    Akun ditangguhkan
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-slate-500">
                    Akun Anda sedang ditangguhkan sehingga tidak dapat
                    digunakan untuk masuk. Silakan hubungi dukungan untuk
                    membuka kembali akun Anda.
                  </p>
                  <div className="mt-6 flex flex-col gap-3">
                    <Link
                      href="/"
                      className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-[#a54150] text-sm font-bold text-white transition hover:bg-[#8c3340]"
                    >
                      Kembali ke beranda
                    </Link>
                    <Link
                      href="/masuk"
                      className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-[#e2d8d2] bg-white text-sm font-bold text-slate-700 transition hover:border-[#cbb7b0]"
                    >
                      Masuk dengan akun lain
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[.2em] text-[#a54150]">
                      Selamat Datang
                    </p>
                    <h2 className="mt-3 font-serif text-3xl font-bold sm:text-4xl">
                      Masuk ke Undangania
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-slate-500">
                      Gunakan email dan kata sandi, atau lanjutkan dengan akun
                      Google.
                    </p>
                  </div>

                  {visibleError ? (
                    <div
                      className="mt-5 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold leading-5 text-rose-700"
                      role="alert"
                      tabIndex={-1}
                      ref={alertRef}
                    >
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      {visibleError}
                    </div>
                  ) : null}

                  <Link
                    href={`/api/auth/google?next=${encodeURIComponent(next)}`}
                    className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#e2d8d2] bg-white text-sm font-bold text-slate-700 shadow-sm transition duration-300 hover:border-[#cbb7b0] hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#4285F4]/10"
                  >
                    <GoogleIcon />
                    Lanjutkan dengan Google
                  </Link>

                  <div className="my-6 flex items-center gap-3">
                    <div className="h-px flex-1 bg-[#ebe2dd]" />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      atau dengan email
                    </span>
                    <div className="h-px flex-1 bg-[#ebe2dd]" />
                  </div>

                  <form action={formAction} className="space-y-4" noValidate>
                    <input type="hidden" name="next" value={next} />
                    <FormField
                      label="Alamat Email"
                      icon={Mail}
                      error={state.fieldErrors.email}
                    >
                      <input
                        type="email"
                        name="email"
                        autoComplete="username"
                        placeholder="nama@email.com"
                        className="h-full min-w-0 flex-1 bg-transparent px-3 text-base outline-none placeholder:text-slate-300"
                      />
                    </FormField>

                    <FormField
                      label="Kata Sandi"
                      icon={LockKeyhole}
                      error={state.fieldErrors.password}
                    >
                      <input
                        type={showPassword ? "text" : "password"}
                        name="password"
                        autoComplete="current-password"
                        placeholder="Kata sandi Anda"
                        className="h-full min-w-0 flex-1 bg-transparent px-3 text-base outline-none placeholder:text-slate-300"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((value) => !value)}
                        aria-label={
                          showPassword
                            ? "Sembunyikan kata sandi"
                            : "Tampilkan kata sandi"
                        }
                        className="mr-2 grid h-9 w-9 place-items-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-[#a54150] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b95363]/10"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </FormField>

                    <div className="flex items-center justify-end gap-4">
                      <Link
                        href={withNext("/lupa-sandi")}
                        className="text-xs font-bold text-[#a54150] transition hover:text-[#84303d]"
                      >
                        Lupa kata sandi?
                      </Link>
                    </div>

                    <RippleButton
                      type="submit"
                      disabled={pending}
                      rippleClassName="bg-white/35"
                      className="flex h-12 w-full items-center justify-center rounded-xl bg-[#a54150] text-sm font-bold text-white shadow-[0_14px_35px_rgba(165,65,80,.26)] transition duration-300 hover:bg-[#8c3340] hover:shadow-[0_18px_44px_rgba(165,65,80,.34)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b95363]/20"
                    >
                      {pending ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : null}
                      {pending ? "Memproses..." : "Masuk"}
                      {pending ? null : (
                        <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                      )}
                    </RippleButton>
                  </form>

                  <p className="mt-6 text-center text-xs text-slate-500">
                    Belum memiliki akun?{" "}
                    <Link
                      href={withNext("/daftar")}
                      className="font-bold text-[#a54150] hover:text-[#84303d]"
                    >
                      Daftar sekarang
                    </Link>
                  </p>
                </>
              )}
            </div>

            <p className="mt-5 text-center text-[11px] leading-5 text-slate-400">
              Dengan masuk, Anda menyetujui Syarat &amp; Ketentuan dan
              Kebijakan Privasi Undangania.
            </p>
          </motion.div>
        </section>
      </div>
    </div>
  );
}
