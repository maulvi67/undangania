import { NextResponse } from "next/server";

/**
 * Liveness probe for container health checks and deploy smoke tests.
 *
 * It intentionally touches no downstream dependency: it answers "this process
 * serves HTTP", not "every provider is reachable". A failing database must not
 * restart an otherwise healthy container.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ status: "ok" });
}
