export function OrderReference({ orderNumber }: { orderNumber: string }) {
  return (
    <p className="ck-order-reference">
      Nomor pesanan: <strong>{orderNumber}</strong>
    </p>
  );
}
