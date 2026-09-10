import type { ReactNode } from "react";

/**
 * Device preview switch. Intentionally CSS-only (native radios + :has()):
 * operable by keyboard and without JavaScript, zero client bundle cost.
 * Phone is the default because most guests open invitations on a phone.
 */
export function DevicePreview({ children }: { children: ReactNode }) {
  return (
    <div className="tpl-device">
      <fieldset className="tpl-device__modes">
        <legend className="tpl-device__legend">Mode pratinjau perangkat</legend>
        <input
          type="radio"
          id="tpl-device-ponsel"
          className="tpl-device__input"
          name="tpl-device"
          value="ponsel"
          defaultChecked
        />
        <label htmlFor="tpl-device-ponsel" className="tpl-device__label">
          Ponsel
        </label>
        <input
          type="radio"
          id="tpl-device-desktop"
          className="tpl-device__input"
          name="tpl-device"
          value="desktop"
        />
        <label htmlFor="tpl-device-desktop" className="tpl-device__label">
          Desktop
        </label>
      </fieldset>
      <div className="tpl-device__stage">
        <div className="tpl-device__frame">
          <div className="tpl-device__frame-bar" aria-hidden="true" />
          <div className="tpl-device__screen">{children}</div>
        </div>
      </div>
    </div>
  );
}
