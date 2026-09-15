import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cx } from "./cx";
import { IconAlert, IconChevronDown } from "./icons";

type FieldChromeProps = {
  /* id is required: label and message wiring depend on it. */
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
};

function FieldLabel({
  id,
  label,
  required,
}: {
  id: string;
  label: string;
  required?: boolean | undefined;
}) {
  return (
    <label className="ui-field__label" htmlFor={id}>
      {label}
      {required ? <span className="ui-field__req"> (wajib)</span> : null}
    </label>
  );
}

function FieldMessages({
  id,
  hint,
  error,
}: {
  id: string;
  hint?: string | undefined;
  error?: string | undefined;
}) {
  return (
    <>
      {hint ? (
        <p className="ui-field__hint" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="ui-field__error" id={`${id}-error`}>
          <IconAlert /> {error}
        </p>
      ) : null}
    </>
  );
}

function describedBy(
  id: string,
  hint?: string,
  error?: string,
): string | undefined {
  const ids = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(
    Boolean,
  );
  return ids.length > 0 ? ids.join(" ") : undefined;
}

export type InputProps = InputHTMLAttributes<HTMLInputElement> &
  FieldChromeProps;

export function Input({
  id,
  label,
  hint,
  error,
  required,
  className,
  ...rest
}: InputProps) {
  return (
    <div className="ui-field">
      <FieldLabel id={id} label={label} required={required} />
      <FieldMessages id={id} hint={hint} error={error} />
      <input
        id={id}
        className={cx(
          "ui-input",
          error ? "ui-input--error" : undefined,
          className,
        )}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        required={required}
        {...rest}
      />
    </div>
  );
}

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> &
  FieldChromeProps;

export function Textarea({
  id,
  label,
  hint,
  error,
  required,
  className,
  ...rest
}: TextareaProps) {
  return (
    <div className="ui-field">
      <FieldLabel id={id} label={label} required={required} />
      <FieldMessages id={id} hint={hint} error={error} />
      <textarea
        id={id}
        className={cx(
          "ui-textarea",
          error ? "ui-textarea--error" : undefined,
          className,
        )}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        required={required}
        {...rest}
      />
    </div>
  );
}

export type SelectOption = { value: string; label: string };

export type SelectProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "children"
> &
  FieldChromeProps & {
    options: ReadonlyArray<SelectOption>;
    placeholder?: string;
  };

export function Select({
  id,
  label,
  hint,
  error,
  required,
  options,
  placeholder,
  className,
  ...rest
}: SelectProps) {
  return (
    <div className="ui-field">
      <FieldLabel id={id} label={label} required={required} />
      <FieldMessages id={id} hint={hint} error={error} />
      <span className="ui-select">
        <select
          id={id}
          className={cx("ui-select__control", className)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
          required={required}
          {...rest}
        >
          {placeholder ? <option value="">{placeholder}</option> : null}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <IconChevronDown className="ui-select__chevron" />
      </span>
    </div>
  );
}
