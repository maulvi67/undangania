import type { AnchorHTMLAttributes } from "react";
import { cx } from "@wedding/ui";

type LinkButtonVariant = "primary" | "secondary" | "tertiary";
type LinkButtonSize = "sm" | "md" | "lg";

export type LinkButtonProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: LinkButtonVariant;
  size?: LinkButtonSize;
};

/**
 * Anchor styled as a button. The `.ui-button` classes from @wedding/ui
 * already carry the approved focus, hover, and target-size behavior;
 * `ui.css` neutralizes link underlining inside `.ui-button`.
 */
export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  ...rest
}: LinkButtonProps) {
  return (
    <a
      className={cx("ui-button", `ui-button--${variant}`, `ui-button--${size}`, className)}
      {...rest}
    />
  );
}
