import type { RefObject } from "react";
import { Select } from "@wedding/ui";
import {
  LOCALE_OPTIONS,
  type FieldErrors,
  type OnboardingData,
  type OnboardingField,
} from "../../lib/onboarding/contract";
import { SummaryCard } from "./summary-card";

type StepPreferencesProps = {
  data: OnboardingData;
  errors: FieldErrors;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onFieldChange: (patch: Partial<OnboardingData>) => void;
  onEditStep: (step: 1 | 2) => void;
};

function fieldProps(field: OnboardingField, errors: FieldErrors) {
  const error = errors[field];
  return error ? { error } : {};
}

/**
 * Langkah 3 — Preferensi (rencana §4): bahasa undangan + ringkasan baca-saja
 * dengan tautan "Ubah" kembali ke langkah 1/2.
 */
export function StepPreferences({
  data,
  errors,
  headingRef,
  onFieldChange,
  onEditStep,
}: StepPreferencesProps) {
  return (
    <section className="onb-step">
      <h1 className="onb-title" tabIndex={-1} ref={headingRef}>
        Preferensi
      </h1>
      <p className="onb-lede">
        Tentukan bahasa undangan dan periksa kembali isian Anda.
      </p>
      <div className="onb-fields">
        <Select
          id="onb-locale"
          name="locale"
          label="Bahasa undangan"
          options={LOCALE_OPTIONS}
          value={data.locale}
          required
          onChange={(event) =>
            onFieldChange({ locale: event.target.value === "en" ? "en" : "id" })
          }
          {...fieldProps("locale", errors)}
        />
      </div>
      <SummaryCard
        data={data}
        title="Ringkasan isian"
        onEditStep={onEditStep}
      />
    </section>
  );
}
