import type { RefObject } from "react";
import { Input, Select, Textarea } from "@wedding/ui";
import {
  ADDRESS_MAX_LENGTH,
  CITY_MAX_LENGTH,
  EVENT_TYPES,
  TIMEZONE_OPTIONS,
  VENUE_MAX_LENGTH,
  isEventType,
  isTimezoneId,
  type FieldErrors,
  type OnboardingData,
  type OnboardingField,
} from "../../lib/onboarding/contract";

type StepEventProps = {
  data: OnboardingData;
  errors: FieldErrors;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onFieldChange: (patch: Partial<OnboardingData>) => void;
};

function fieldProps(field: OnboardingField, errors: FieldErrors) {
  const error = errors[field];
  return error ? { error } : {};
}

/**
 * Langkah 2 — Acara pertama (rencana §4). Zona waktu dikelompokkan dengan
 * kota (satu jawaban "di mana"); alamat terungkap progresif setelah nama
 * venue diisi. Tanpa atribut `min` pada tanggal — server yang memvalidasi
 * masa lalu, dan `min` berisiko tidak sinkron saat pergantian hari.
 */
export function StepEvent({
  data,
  errors,
  headingRef,
  onFieldChange,
}: StepEventProps) {
  const addressVisible = data.venueName.trim() !== "";

  return (
    <section className="onb-step">
      <h1 className="onb-title" tabIndex={-1} ref={headingRef}>
        Acara pertama
      </h1>
      <p className="onb-lede">
        Mulai dari acara pertama Anda — acara lain bisa ditambahkan setelahnya
        dari editor.
      </p>
      <div className="onb-fields">
        <Select
          id="onb-eventType"
          name="eventType"
          label="Jenis acara"
          options={EVENT_TYPES.map((type) => ({ value: type, label: type }))}
          value={data.eventType}
          required
          onChange={(event) => {
            const value = event.target.value;
            // Opsi select persis EVENT_TYPES; guard mempersempit tipe tanpa cast.
            if (isEventType(value)) onFieldChange({ eventType: value });
          }}
          {...fieldProps("eventType", errors)}
        />
        <Input
          id="onb-eventDate"
          name="eventDate"
          type="date"
          label="Tanggal acara"
          value={data.eventDate}
          enterKeyHint="next"
          required
          onChange={(event) => onFieldChange({ eventDate: event.target.value })}
          {...fieldProps("eventDate", errors)}
        />
        <Input
          id="onb-eventTime"
          name="eventTime"
          type="time"
          label="Waktu acara"
          value={data.eventTime}
          enterKeyHint="next"
          required
          onChange={(event) => onFieldChange({ eventTime: event.target.value })}
          {...fieldProps("eventTime", errors)}
        />
        <Input
          id="onb-city"
          name="city"
          label="Kota"
          value={data.city}
          maxLength={CITY_MAX_LENGTH}
          autoComplete="address-level2"
          autoCapitalize="words"
          enterKeyHint="next"
          required
          onChange={(event) => onFieldChange({ city: event.target.value })}
          {...fieldProps("city", errors)}
        />
        <Select
          id="onb-timezone"
          name="timezone"
          label="Zona waktu"
          options={TIMEZONE_OPTIONS}
          value={data.timezone}
          required
          onChange={(event) => {
            const value = event.target.value;
            if (isTimezoneId(value)) onFieldChange({ timezone: value });
          }}
          {...fieldProps("timezone", errors)}
        />
        <Input
          id="onb-venueName"
          name="venueName"
          label="Nama venue"
          value={data.venueName}
          maxLength={VENUE_MAX_LENGTH}
          autoComplete="off"
          autoCapitalize="words"
          enterKeyHint={addressVisible ? "next" : "done"}
          required
          onChange={(event) => onFieldChange({ venueName: event.target.value })}
          {...fieldProps("venueName", errors)}
        />
        {addressVisible ? (
          <Textarea
            id="onb-venueAddress"
            name="venueAddress"
            label="Alamat venue (opsional)"
            hint="Bisa dilengkapi nanti dari editor."
            value={data.venueAddress}
            rows={3}
            maxLength={ADDRESS_MAX_LENGTH}
            autoComplete="street-address"
            onChange={(event) =>
              onFieldChange({ venueAddress: event.target.value })
            }
            {...fieldProps("venueAddress", errors)}
          />
        ) : null}
      </div>
    </section>
  );
}
