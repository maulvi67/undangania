export function FairUsagePanel({ items }: { items: readonly string[] }) {
  return (
    <section className="ck-info-block" aria-labelledby="ck-fair-use-title">
      <h2 className="ck-info-block__title" id="ck-fair-use-title">
        Penggunaan yang wajar
      </h2>
      <ul className="ck-checklist">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p className="ck-info-block__muted">
        Detail batas penggunaan ditampilkan secara transparan di workspace dan
        tidak mengubah fitur inti antar desain.
      </p>
    </section>
  );
}
