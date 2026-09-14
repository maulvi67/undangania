import type { RefObject } from "react";
import { Checkbox, Input } from "@wedding/ui";
import {
  NAME_MAX_LENGTH,
  type FieldErrors,
  type OnboardingData,
  type OnboardingField,
} from "../../lib/onboarding/contract";

type StepCoupleProps = {
  data: OnboardingData;
  errors: FieldErrors;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onFieldChange: (patch: Partial<OnboardingData>) => void;
};

/** exactOptionalPropertyTypes: `error` hanya dikirim bila ada pesannya. */
function fieldProps(field: OnboardingField, errors: FieldErrors) {
  const error = errors[field];
  return error ? { error } : {};
}

/** Langkah 1 — Mempelai (rencana §4). Tanggal pernikahan opsional. */
export function StepCouple({ data, errors, headingRef, onFieldChange }: StepCoupleProps) {
  return (
    <section className="onb-step">
      <h1 className="onb-title" tabIndex={-1} ref={headingRef}>
        Mempelai
      </h1>
      <p className="onb-lede">Isi nama kedua mempelai yang akan tampil pada undangan.</p>
      <div className="onb-fields">
        <Input
          id="onb-partner1Name"
          name="partner1Name"
          label="Nama mempelai pertama"
          value={data.partner1Name}
          maxLength={NAME_MAX_LENGTH}
          autoCapitalize="words"
          autoComplete="off"
          enterKeyHint="next"
          required
          onChange={(event) => onFieldChange({ partner1Name: event.target.value })}
          {...fieldProps("partner1Name", errors)}
        />
        <Input
          id="onb-partner2Name"
          name="partner2Name"
          label="Nama mempelai kedua"
          value={data.partner2Name}
          maxLength={NAME_MAX_LENGTH}
          autoCapitalize="words"
          autoComplete="off"
          enterKeyHint="next"
          required
          onChange={(event) => onFieldChange({ partner2Name: event.target.value })}
          {...fieldProps("partner2Name", errors)}
        />
        <Input
          id="onb-weddingDate"
          name="weddingDate"
          type="date"
          label="Tanggal pernikahan (opsional)"
          hint="Bisa dilewati jika belum pasti."
          value={data.weddingDate}
          disabled={data.weddingDateUndecided}
          enterKeyHint="next"
          onChange={(event) => onFieldChange({ weddingDate: event.target.value })}
          {...fieldProps("weddingDate", errors)}
        />
        <Checkbox
          id="onb-weddingDateUndecided"
          name="weddingDateUndecided"
          label="Tanggal pernikahan belum ditentukan"
          checked={data.weddingDateUndecided}
          onChange={(event) => onFieldChange({ weddingDateUndecided: event.target.checked })}
        />
      </div>
    </section>
  );
}
