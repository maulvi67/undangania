export function MaskedValue({
  value,
  label = "Data sensitif",
}: {
  value: string;
  label?: string;
}) {
  return (
    <span className="admin-masked-value" aria-label={`${label}: disamarkan`}>
      <span aria-hidden="true">{value}</span>
      <span className="admin-masked-value__note">disamarkan</span>
    </span>
  );
}
