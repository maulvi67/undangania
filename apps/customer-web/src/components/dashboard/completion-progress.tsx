import { IconCheck } from "@wedding/ui";
import {
  completionCount,
  type CompletionItem,
} from "../../lib/dashboard/contract";

export function CompletionProgress({
  items,
}: {
  items: ReadonlyArray<CompletionItem>;
}) {
  const count = completionCount(items);

  return (
    <section className="dash-section" aria-labelledby="dash-progress-title">
      <div className="dash-section__head">
        <div>
          <p className="dash-section__eyebrow">Panduan singkat</p>
          <h2 className="dash-section__title" id="dash-progress-title">
            Progres persiapan
          </h2>
        </div>
        <p className="dash-progress__count">
          {count.done} dari {count.total} selesai
        </p>
      </div>

      <div className="dash-progress__track" aria-hidden="true">
        {items.map((item) => (
          <span
            className={`dash-progress__segment${item.done ? " dash-progress__segment--done" : ""}`}
            key={item.id}
          />
        ))}
      </div>

      <ol className="dash-progress__list">
        {items.map((item) => (
          <li className="dash-progress__item" key={item.id}>
            <span
              className={`dash-progress__mark${item.done ? " dash-progress__mark--done" : ""}`}
              aria-hidden="true"
            >
              {item.done ? <IconCheck /> : ""}
            </span>
            {item.done ? (
              <span>
                <span className="ui-visually-hidden">Selesai: </span>
                {item.label}
              </span>
            ) : item.href !== undefined ? (
              <a href={item.href}>
                <span className="ui-visually-hidden">Belum selesai: </span>
                {item.label}
              </a>
            ) : (
              <span>
                <span className="ui-visually-hidden">Belum selesai: </span>
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
