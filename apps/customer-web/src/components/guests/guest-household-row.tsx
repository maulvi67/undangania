import Link from "next/link";
import { Badge, Checkbox } from "@wedding/ui";
import type { GuestHouseholdListItem } from "../../lib/guests/contract";

export function GuestHouseholdRow({
  household,
  selected,
  onSelectedChange,
}: {
  household: GuestHouseholdListItem;
  selected: boolean;
  onSelectedChange: (selected: boolean) => void;
}) {
  return (
    <tr>
      <td>
        <Checkbox
          id={`select-desktop-${household.id}`}
          label={`Pilih ${household.displayName}`}
          checked={selected}
          onChange={(event) => onSelectedChange(event.target.checked)}
        />
      </td>
      <th scope="row">
        <Link
          className="gst-table__household"
          href={`/tamu/${household.id}`}
        >
          {household.displayName}
        </Link>
        <span className="gst-table__subtext">{household.memberCount} tamu</span>
      </th>
      <td>{household.maximumPax}</td>
      <td>
        <ul className="gst-table__list">
          {household.eventNames.map((eventName) => (
            <li key={eventName}>{eventName}</li>
          ))}
        </ul>
      </td>
      <td>
        {household.tags.length > 0 ? (
          <ul className="gst-table__list gst-table__list--tags">
            {household.tags.map((tag) => (
              <li key={tag}>{tag}</li>
            ))}
          </ul>
        ) : (
          <span className="gst-muted">Belum ada</span>
        )}
      </td>
      <td>
        <Badge tone={household.linkStatus === "ACTIVE" ? "olive" : "blush"}>
          {household.linkStatus === "ACTIVE" ? "Aktif" : "Dinonaktifkan"}
        </Badge>
      </td>
      <td>
        <Link
          className="gst-table__action"
          href={`/tamu/${household.id}`}
        >
          Kelola
        </Link>
      </td>
    </tr>
  );
}
