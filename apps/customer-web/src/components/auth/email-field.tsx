import { Input } from "@wedding/ui";

type EmailFieldProps = {
  /** `username` on sign-in (password-manager convention), `email` elsewhere. */
  autoComplete?: "username" | "email";
  error?: string | undefined;
  hint?: string | undefined;
};

/**
 * Email input with the mobile-keyboard and password-manager attribute set
 * from the design plan §6. Paste is never intercepted.
 */
export function EmailField({
  autoComplete = "email",
  error,
  hint,
}: EmailFieldProps) {
  return (
    <Input
      id="email"
      label="Email"
      name="email"
      type="email"
      inputMode="email"
      autoComplete={autoComplete}
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      enterKeyHint="go"
      required
      {...(error ? { error } : {})}
      {...(hint ? { hint } : {})}
    />
  );
}
