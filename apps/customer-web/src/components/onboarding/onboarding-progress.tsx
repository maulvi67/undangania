import { IconCheck } from "@wedding/ui";
import { ONBOARDING_STEPS, type StepId } from "../../lib/onboarding/contract";

/**
 * Kepala alur onboarding (rencana §9): posisi langkah, lajur hairline
 * tiga segmen, dan daftar langkah dengan tanda selesai — bukan sekadar
 * warna. Lajur dekoratif (aria-hidden); status "selesai" dibawa teks
 * tersembunyi dan tanda centang.
 */
export function OnboardingProgress({ step }: { step: StepId }) {
  return (
    <div className="onb-progress">
      <p className="onb-progress__label" id="onb-progress-label">
        Langkah {step} dari 3
      </p>
      <div className="onb-progress__track" aria-hidden="true">
        {ONBOARDING_STEPS.map(({ id }) => (
          <span
            key={id}
            className={`onb-progress__seg${id <= step ? " onb-progress__seg--done" : ""}`}
          />
        ))}
      </div>
      <ol className="onb-progress__steps" aria-labelledby="onb-progress-label">
        {ONBOARDING_STEPS.map(({ id, title }) => (
          <li
            key={id}
            className="onb-progress__step"
            aria-current={id === step ? "step" : undefined}
          >
            {id < step ? (
              <span className="onb-progress__mark">
                <IconCheck />
                <span className="ui-visually-hidden">Selesai: </span>
              </span>
            ) : null}
            <span className="onb-progress__title">{title}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
