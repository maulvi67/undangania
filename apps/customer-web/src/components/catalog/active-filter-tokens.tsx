import Link from "next/link";
import type { CatalogQuery } from "./catalog-query";
import { activeFilterTokens } from "./catalog-query";

/**
 * Removable chips summarizing the active query. Each token is a plain link
 * to the same catalog with exactly that param cleared — works without JS
 * and keeps the URL as the single source of truth.
 */
export function ActiveFilterTokens({ query }: { query: CatalogQuery }) {
  const tokens = activeFilterTokens(query);
  if (tokens.length === 0) return null;

  return (
    <ul className="ctlg-tokens" aria-label="Filter aktif">
      {tokens.map((token) => (
        <li key={token.key}>
          <a className="ctlg-tokens__token" href={token.href}>
            {token.label}
            <span className="ctlg-tokens__remove" aria-hidden="true">
              ×
            </span>
            <span className="ui-visually-hidden">— hapus filter ini</span>
          </a>
        </li>
      ))}
      <li>
        <Link className="ctlg-tokens__clear" href="/templates">
          Hapus semua
        </Link>
      </li>
    </ul>
  );
}
