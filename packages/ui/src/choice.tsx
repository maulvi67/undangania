import type { InputHTMLAttributes } from "react";
import { cx } from "./cx";

export type CheckboxProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
> & {
  label: string;
  hint?: string;
};

export function Checkbox({
  id,
  label,
  hint,
  className,
  ...rest
}: CheckboxProps) {
  return (
    <div className="ui-choice">
      <input
        id={id}
        type="checkbox"
        className={cx("ui-choice__input", className)}
        {...rest}
      />
      <label className="ui-choice__label" htmlFor={id}>
        {label}
        {hint ? <span className="ui-choice__hint">{hint}</span> : null}
      </label>
    </div>
  );
}

export type RadioOption = { value: string; label: string; hint?: string };

export type RadioGroupProps = {
  name: string;
  legend: string;
  hint?: string;
  options: ReadonlyArray<RadioOption>;
  defaultValue?: string;
  required?: boolean;
};

export function RadioGroup({
  name,
  legend,
  hint,
  options,
  defaultValue,
  required,
}: RadioGroupProps) {
  return (
    <fieldset className="ui-fieldset">
      <legend className="ui-fieldset__legend">{legend}</legend>
      {hint ? <p className="ui-field__hint">{hint}</p> : null}
      <div className="ui-stack">
        {options.map((option) => (
          <div className="ui-choice" key={option.value}>
            <input
              type="radio"
              id={`${name}-${option.value}`}
              name={name}
              value={option.value}
              className="ui-choice__input"
              defaultChecked={defaultValue === option.value}
              required={required}
            />
            <label
              className="ui-choice__label"
              htmlFor={`${name}-${option.value}`}
            >
              {option.label}
              {option.hint ? (
                <span className="ui-choice__hint">{option.hint}</span>
              ) : null}
            </label>
          </div>
        ))}
      </div>
    </fieldset>
  );
}
