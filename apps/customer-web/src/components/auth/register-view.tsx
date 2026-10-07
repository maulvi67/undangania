"use client";

import {
  useActionState,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
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
  Phone,
  ShieldCheck,
  Sparkles,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { registerAction, resendVerificationAction } from "../../lib/auth/actions";
import {
  AUTH_ERROR_MESSAGES,
  INITIAL_AUTH_FORM_STATE,
  MIN_PASSWORD_LENGTH,
  type AuthFormState,
} from "../../lib/auth/contract";

/**
 * `/daftar` — the real registration form.
 *
 * The auth contract accepts an email and a password; the action normalizes and
 * validates both on the server, provisions the account, and asks for the
 * verification email. The name and WhatsApp fields are collected here for the
 * couple's own confirmation but are not part of the auth contract yet, so they
 * are not sent to the server (see the completion report for that gap).
 *
 * A successful registration ends on the "check your email" interstitial — the
 * real next step of the flow — not on the dashboard.
 */

/** Cubic-bezier easing untuk animasi masuk. */
const ease: [number, number, number, number] = [0.22, 1, 0.36, 1];

const featureItems = [
  "Pilih template dengan harga transparan",
  "Kelola RSVP dan buku tamu",
  "Edit undangan melalui dashboard",
];

const strengthLabels = ["Belum ada", "Lemah", "Cukup", "Kuat", "Sangat kuat"] as const;

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path
        fill="#4285F4"
        d="M21.35 12.23c0-.71-.06-1.24-.2-1.79H12v3.26h5.37a4.7 4.7 0 0 1-2 3.04l3.08 2.38c1.84-1.69 2.9-4.19 2.9-6.89Z"
      />
      <path
        fill="#34A853"
        d="M12 21.75c2.62 0 4.82-.86 6.43-2.63l-3.07-2.38c-.82.55-1.92.94-3.36.94a5.83 5.83 0 0 1-5.52-4.03L3.33 16.1A9.7 9.7 0 0 0 12 21.75Z"
      />
      <path
        fill="#FBBC05"
        d="M6.48 13.65A5.98 5.98 0 0 1 6.16 12c0-.57.11-1.12.3-1.65L3.33 7.92A9.75 9.75 0 0 0 2.25 12c0 1.47.38 2.85 1.08 4.08l3.15-2.43Z"
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
  onClick,
  disabled = false,
  className = "",
  rippleClassName = "bg-white/30",
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

interface FieldProps {
  label: string;
  icon: LucideIcon;
  error?: string | undefined;
  optional?: boolean;
  children: ReactNode;
}

function Field({ label, icon: Icon, error, optional = false, children }: FieldProps) {
  return (
    <label className="block">
      <span className="flex items-center justify-between text-xs font-bold text-slate-700">
        <span>{label}</span>
        {optional ? (
          <span className="font-medium text-slate-400">Opsional</span>
        ) : null}
      </span>
      <div
        className={`mt-2 flex h-12 items-center rounded-xl border bg-white transition duration-300 focus-within:ring-4 ${
          error
            ? "border-rose-400 focus-within:ring-rose-100"
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

interface RegisterFormState {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirm: string;
}

type RegisterField = keyof RegisterFormState;

interface RegisterErrors {
  name?: string | undefined;
  email?: string | undefined;
  phone?: string | undefined;
  password?: string | undefined;
  confirm?: string | undefined;
  agree?: string | undefined;
}

function clearFieldError(
  errors: RegisterErrors,
  key: RegisterField,
): RegisterErrors {
  if (errors[key] === undefined) return errors;
  const next = { ...errors };
  delete next[key];
  return next;
}

function formLevelMessage(state: AuthFormState): string {
  if (state.status !== "error" || !state.code) return "";
  return AUTH_ERROR_MESSAGES[state.code];
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[0-9+\-\s]{9,16}$/;

function RegisterFlow({
  next,
  signInTarget,
  onUseAnotherEmail,
}: {
  next: string;
  signInTarget: string;
  onUseAnotherEmail: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    registerAction,
    INITIAL_AUTH_FORM_STATE,
  );
  const [resendState, resendAction, resendPending] = useActionState(
    resendVerificationAction,
    INITIAL_AUTH_FORM_STATE,
  );
  const [form, setForm] = useState<RegisterFormState>({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirm: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agree, setAgree] = useState(false);
  const [errors, setErrors] = useState<RegisterErrors>({});

  const strength = useMemo(() => {
    const password = form.password;
    let score = 0;
    if (password.length >= MIN_PASSWORD_LENGTH) score += 1;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    return score;
  }, [form.password]);

  const strengthText = strengthLabels[strength] ?? "Belum ada";

  const update =
    (key: RegisterField) => (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setForm((current) => ({ ...current, [key]: value }));
      setErrors((current) => clearFieldError(current, key));
    };

  const validate = (): boolean => {
    const next: RegisterErrors = {};
    if (!form.name.trim()) next.name = "Nama lengkap wajib diisi.";
    if (!form.email.trim()) next.email = "Email wajib diisi.";
    else if (!EMAIL_PATTERN.test(form.email))
      next.email = "Format email belum valid.";
    if (form.phone && !PHONE_PATTERN.test(form.phone))
      next.phone = "Nomor WhatsApp belum valid.";
    if (!form.password) next.password = "Kata sandi wajib diisi.";
    else if (form.password.length < MIN_PASSWORD_LENGTH)
      next.password = `Gunakan minimal ${MIN_PASSWORD_LENGTH} karakter.`;
    if (!form.confirm) next.confirm = "Konfirmasi kata sandi wajib diisi.";
    else if (form.confirm !== form.password)
      next.confirm = "Konfirmasi kata sandi tidak sama.";
    if (!agree)
      next.agree = "Setujui syarat dan kebijakan privasi untuk melanjutkan.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (!validate()) event.preventDefault();
  };

  // Real interstitial: the account exists and the verification email was sent.
  if (state.status === "done") {
    const email = state.emailSentTo ?? form.email;
    return (
      <div>
        <p className="text-xs font-bold uppercase tracking-[.2em] text-[#a54150]">
          Satu Langkah Lagi
        </p>
        <h2 className="mt-3 font-serif text-3xl font-bold sm:text-4xl">
          Cek email Anda
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          Kami mengirimkan tautan verifikasi ke{" "}
          <strong className="text-slate-700">{email}</strong>. Tautan berlaku 24
          jam — buka aplikasi email Anda, lalu pilih tautan verifikasi untuk
          mengaktifkan akun.
        </p>

        <div className="mt-6 rounded-2xl border border-[#f0e2dd] bg-[#fffaf7] p-4">
          <p className="text-xs leading-5 text-slate-500">
            Belum menerima emailnya? Periksa folder spam, atau kirim ulang
            tautan verifikasi.
          </p>
          <form action={resendAction} className="mt-3">
            <input type="hidden" name="email" value={email} />
            <RippleButton
              type="submit"
              disabled={resendPending}
              rippleClassName="bg-[#a54150]/10"
              className="flex h-11 w-full items-center justify-center rounded-xl border border-[#e2d8d2] bg-white text-sm font-bold text-slate-700 transition hover:border-[#cbb7b0]"
            >
              {resendPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mail className="h-4 w-4" />
              )}
              {resendPending ? "Mengirim..." : "Kirim ulang tautan verifikasi"}
            </RippleButton>
          </form>
          {resendState.status === "done" ? (
            <p className="mt-3 text-xs font-semibold text-emerald-700" role="status">
              Tautan verifikasi telah dikirim ulang ke email Anda.
            </p>
          ) : null}
          {formLevelMessage(resendState) ? (
            <p className="mt-3 text-xs font-semibold text-rose-600" role="alert">
              {formLevelMessage(resendState)}
            </p>
          ) : null}
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <Link
            href={signInTarget}
            className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-[#a54150] text-sm font-bold text-white transition hover:bg-[#8c3340]"
          >
            Masuk ke akun saya
          </Link>
          <button
            type="button"
            onClick={onUseAnotherEmail}
            className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-[#e2d8d2] bg-white text-sm font-bold text-slate-700 transition hover:border-[#cbb7b0]"
          >
            Daftar dengan email lain
          </button>
        </div>
      </div>
    );
  }

  const visibleError = formLevelMessage(state);
  const emailError = errors.email ?? state.fieldErrors.email;
  const passwordError = errors.password ?? state.fieldErrors.password;

  return (
    <>
      <p className="text-xs font-bold uppercase tracking-[.2em] text-[#a54150]">
        Buat Akun
      </p>
      <h2 className="mt-3 font-serif text-3xl font-bold sm:text-4xl">
        Daftar ke Undangania
      </h2>
      <p className="mt-3 text-sm leading-6 text-slate-500">
        Isi data berikut atau lanjutkan dengan akun Google.
      </p>

      {visibleError ? (
        <div
          className="mt-5 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold leading-5 text-rose-700"
          role="alert"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {visibleError}
        </div>
      ) : null}

      <Link
        href={`/api/auth/google?next=${encodeURIComponent(next)}`}
        className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#e2d8d2] bg-white text-sm font-bold text-slate-700 shadow-sm transition hover:border-[#cbb7b0] hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#4285F4]/10"
      >
        <GoogleIcon />
        Daftar dengan Google
      </Link>
      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-[#ebe2dd]" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          atau dengan email
        </span>
        <div className="h-px flex-1 bg-[#ebe2dd]" />
      </div>

      <form action={formAction} onSubmit={handleSubmit} noValidate className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nama Lengkap" icon={UserRound} error={errors.name}>
            <input
              name="name"
              value={form.name}
              onChange={update("name")}
              autoComplete="name"
              placeholder="Nama lengkap"
              className="h-full min-w-0 flex-1 bg-transparent px-3 text-base outline-none"
            />
          </Field>
          <Field
            label="Nomor WhatsApp"
            icon={Phone}
            error={errors.phone}
            optional
          >
            <input
              name="phone"
              value={form.phone}
              onChange={update("phone")}
              autoComplete="tel"
              inputMode="tel"
              placeholder="08xxxxxxxxxx"
              className="h-full min-w-0 flex-1 bg-transparent px-3 text-base outline-none"
            />
          </Field>
        </div>
        <Field label="Alamat Email" icon={Mail} error={emailError}>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={update("email")}
            autoComplete="email"
            placeholder="nama@email.com"
            className="h-full min-w-0 flex-1 bg-transparent px-3 text-base outline-none"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Kata Sandi"
            icon={LockKeyhole}
            error={passwordError}
          >
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              value={form.password}
              onChange={update("password")}
              autoComplete="new-password"
              placeholder={`Minimal ${MIN_PASSWORD_LENGTH} karakter`}
              className="h-full min-w-0 flex-1 bg-transparent px-3 text-base outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={
                showPassword
                  ? "Sembunyikan kata sandi"
                  : "Tampilkan kata sandi"
              }
              className="mr-2 grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-[#a54150]"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </Field>
          <Field
            label="Konfirmasi Kata Sandi"
            icon={LockKeyhole}
            error={errors.confirm}
          >
            <input
              type={showConfirm ? "text" : "password"}
              value={form.confirm}
              onChange={update("confirm")}
              autoComplete="new-password"
              placeholder="Ulangi kata sandi"
              className="h-full min-w-0 flex-1 bg-transparent px-3 text-base outline-none"
            />
            <button
              type="button"
              onClick={() => setShowConfirm((value) => !value)}
              aria-label={
                showConfirm
                  ? "Sembunyikan konfirmasi kata sandi"
                  : "Tampilkan konfirmasi kata sandi"
              }
              className="mr-2 grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-[#a54150]"
            >
              {showConfirm ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </Field>
        </div>

        {form.password ? (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl bg-[#faf6f3] p-3"
          >
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-slate-600">
                Kekuatan kata sandi
              </span>
              <span className="text-slate-500">{strengthText}</span>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-1">
              {[1, 2, 3, 4].map((level) => (
                <span
                  key={level}
                  className={`h-1.5 rounded-full transition-colors ${
                    level <= strength
                      ? strength <= 1
                        ? "bg-rose-500"
                        : strength === 2
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                      : "bg-slate-200"
                  }`}
                />
              ))}
            </div>
          </motion.div>
        ) : null}

        <div>
          <label className="flex cursor-pointer items-start gap-3">
            <button
              type="button"
              role="checkbox"
              aria-checked={agree}
              onClick={() => {
                setAgree((value) => !value);
                if (errors.agree) {
                  setErrors((current) => ({ ...current, agree: undefined }));
                }
              }}
              className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border transition ${
                agree
                  ? "border-[#a54150] bg-[#a54150] text-white"
                  : "border-[#d9cec8] bg-white text-transparent"
              }`}
            >
              <Check className="h-3 w-3" />
            </button>
            <span className="text-xs leading-5 text-slate-500">
              Saya menyetujui Syarat &amp; Ketentuan dan Kebijakan Privasi
              Undangania.
            </span>
          </label>
          {errors.agree ? (
            <p className="mt-1.5 text-xs text-rose-600">{errors.agree}</p>
          ) : null}
        </div>

        <RippleButton
          type="submit"
          disabled={pending}
          rippleClassName="bg-white/35"
          className="flex h-12 w-full items-center justify-center rounded-xl bg-[#a54150] text-sm font-bold text-white shadow-[0_14px_35px_rgba(165,65,80,.26)] transition hover:bg-[#8c3340] hover:shadow-[0_18px_44px_rgba(165,65,80,.34)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b95363]/20"
        >
          {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
          {pending ? "Membuat akun..." : "Buat Akun"}
          {pending ? null : (
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          )}
        </RippleButton>
      </form>

      <p className="mt-6 text-center text-xs text-slate-500">
        Sudah memiliki akun?{" "}
        <Link
          href={signInTarget}
          className="font-bold text-[#a54150] hover:text-[#84303d]"
        >
          Masuk sekarang
        </Link>
      </p>
    </>
  );
}

interface RegisterViewProps {
  /** Server-validated redirect target carried into the sign-in link. */
  next: string;
}

export function RegisterView({ next }: RegisterViewProps) {
  const reduceMotion = useReducedMotion();
  const [flowKey, setFlowKey] = useState(0);
  const signInTarget =
    next && next !== "/" ? `/masuk?next=${encodeURIComponent(next)}` : "/masuk";

  return (
    <div className="min-h-screen bg-[#fbf8f5] text-slate-900">
      <div className="grid min-h-screen lg:grid-cols-[.95fr_1.05fr]">
        <section className="relative hidden overflow-hidden bg-[#19131a] p-10 text-white lg:flex lg:flex-col xl:p-14">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(201,104,120,.46),transparent_32%),radial-gradient(circle_at_82%_12%,rgba(214,169,108,.24),transparent_30%),linear-gradient(140deg,#171219_5%,#39222c_52%,#171218_100%)]" />
          <motion.div
            animate={reduceMotion ? {} : { x: [-18, 34, -18], y: [10, -22, 10] }}
            transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -left-20 top-32 h-96 w-96 rounded-full bg-[#af4959]/20 blur-3xl"
          />
          <motion.div
            animate={reduceMotion ? {} : { x: [18, -28, 18], y: [-10, 28, -10] }}
            transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -right-20 top-10 h-[28rem] w-[28rem] rounded-full bg-[#d6a96c]/14 blur-3xl"
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
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-bold text-[#efc78e]">
              <Sparkles className="h-4 w-4" /> Mulai cerita istimewa Anda
            </div>
            <h1 className="mt-7 font-serif text-5xl font-bold leading-[1.08] xl:text-6xl">
              Buat undangan digital yang{" "}
              <span className="bg-gradient-to-r from-[#f3bac3] to-[#efc78e] bg-clip-text text-transparent">
                personal dan berkesan.
              </span>
            </h1>
            <p className="mt-6 max-w-lg text-base leading-8 text-white/60">
              Daftar untuk memilih template, melengkapi cerita, dan membagikan
              undangan kepada orang terdekat.
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
            <ShieldCheck className="h-4 w-4" /> Data akun dilindungi dengan
            autentikasi aman
          </div>
        </section>

        <section className="relative flex min-h-screen items-center justify-center px-4 py-8 sm:px-8 lg:px-12">
          <div className="absolute left-4 top-5 lg:hidden">
            <Logo />
          </div>
          <Link
            href="/"
            className="absolute right-4 top-5 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-slate-500 transition hover:bg-white hover:text-[#a54150]"
          >
            <ArrowLeft className="h-4 w-4" /> Kembali
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.72, ease }}
            className="mt-16 w-full max-w-xl lg:mt-0"
          >
            <div className="rounded-[30px] border border-white/80 bg-white/90 p-5 shadow-[0_30px_90px_rgba(74,48,51,.12)] backdrop-blur-xl sm:p-8">
              <RegisterFlow
                key={flowKey}
                next={next}
                signInTarget={signInTarget}
                onUseAnotherEmail={() => setFlowKey((value) => value + 1)}
              />
            </div>
          </motion.div>
        </section>
      </div>
    </div>
  );
}
