import Link from "next/link";

export function SupportLink({
  children = "Buka bantuan",
}: {
  children?: string;
}) {
  return (
    <Link className="ck-support-link" href="/#faq">
      {children}
    </Link>
  );
}
