"use client";

import { useId, useState } from "react";
import { Button, cx } from "@wedding/ui";

type PasswordFieldProps = {
  id?: string;
  label?: string;
  autoComplete: "current-password" | "new-password";
  hint?: string | undefined;
  error?: string | undefined;
  enterKeyHint?: "go" | "done" | "send";
};

/**
 * Password input with a show/hide toggle (design plan §6).
 *
 * The toggle is a real `<button aria-pressed>` next to the input — it never
 * renames, replaces, or re-creates the input (password-manager capture is
 * preserved) and nothing here ever blocks paste. The aria wiring mirrors
 * `Input` from @wedding/ui so field errors announce identically.
 */
export function PasswordField({
  id,
  label = "Kata sandi",
  autoComplete,
  hint,
  error,
  enterKeyHint,
}: PasswordFieldProps) {
  const inputId = id ?? "password";
  const [visible, setVisible] = useState(false);
  const hintId = useId();

  return (
    <div className="ui-field">
      <label className="ui-field__label" htmlFor={inputId}>
        {label}
        <span className="ui-field__req"> (wajib)</span>
      </label>
      {hint ? (
        <p className="ui-field__hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="ui-field__error" id={`${inputId}-error`}>
          {error}
        </p>
      ) : null}
      <span className="auth-password__control">
        <input
          id={inputId}
          name="password"
          className={cx("ui-input", "auth-password__input", error ? "ui-input--error" : undefined)}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          enterKeyHint={enterKeyHint}
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={cx(hint ? hintId : undefined, error ? `${inputId}-error` : undefined) || undefined}
        />
        <Button
          type="button"
          variant="tertiary"
          size="sm"
          className="auth-password__toggle"
          aria-pressed={visible}
          aria-label={visible ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
          onClick={() => setVisible((value) => !value)}
        >
          {visible ? "Sembunyikan" : "Tampilkan"}
        </Button>
      </span>
    </div>
  );
}
