import Link from "next/link";
import { Badge, Checkbox } from "@wedding/ui";
import type {
  GuestHouseholdListItem,
  GuestListQuery,
} from "../../lib/guests/contract";
import { guestQueryHref } from "../../lib/guests/contract";

function linkTone(
  status: GuestHouseholdListItem["linkStatus"],
): "olive" | "blush" {
  return status === "ACTIVE" ? "olive" : "blush";
}

export function GuestHouseholdCard({
  household,
  query,
  selected,
  onSelectedChange,
}: {
  household: GuestHouseholdListItem;
  query: GuestListQuery;
  selected: boolean;
  onSelectedChange: (selected: boolean) => void;
}) {
  return (
    <article className="gst-card">
      <div className="gst-card__topline">
        <Checkbox
          id={`select-${household.id}`}
          label={`Pilih ${household.displayName}`}
          checked={selected}
          onChange={(event) => onSelectedChange(event.target.checked)}
        />
        <Badge tone={linkTone(household.linkStatus)}>
          {household.linkStatus === "ACTIVE"
            ? "Tautan aktif"
            : "Tautan dinonaktifkan"}
        </Badge>
      </div>
      <div className="gst-card__body">
        <h2 className="gst-card__title">{household.displayName}</h2>
        <p className="gst-card__meta">
          {household.memberCount} tamu · maksimal {household.maximumPax} pax
        </p>
        <ul
          className="gst-card__events"
          aria-label={`Akses acara ${household.displayName}`}
        >
          {household.eventNames.map((eventName) => (
            <li key={eventName}>{eventName}</li>
          ))}
        </ul>
        {household.tags.length > 0 ? (
          <ul
            className="gst-card__tags"
            aria-label={`Tag ${household.displayName}`}
          >
            {household.tags.map((tag) => (
              <li key={tag}>{tag}</li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="gst-card__actions">
        <Link
          className="ui-button ui-button--secondary ui-button--md"
          href={`/tamu/${household.id}`}
        >
          Kelola
        </Link>
        <Link
          className="gst-card__quiet-link"
          href={guestQueryHref(query, { q: household.displayName })}
        >
          Cari yang serupa
        </Link>
      </div>
    </article>
  );
}
