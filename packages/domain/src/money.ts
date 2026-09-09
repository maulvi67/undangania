export type Currency = "IDR" | "USD";
export type Money = Readonly<{ amountMinor: bigint; currency: Currency }>;
export function addMoney(a: Money, b: Money): Money { if (a.currency !== b.currency) throw new Error("Currency mismatch"); return { amountMinor: a.amountMinor + b.amountMinor, currency: a.currency }; }
