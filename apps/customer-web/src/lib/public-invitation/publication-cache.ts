/**
 * Read-through cache for the public invitation lookup.
 *
 * Only the publication row is cached, never resolved media: read URLs are short
 * lived signed URLs, so caching them would serve expiring links. The snapshot is
 * JSON-safe (strings, enums, `unknown`), which keeps the round-trip lossless.
 *
 * The TTL is a backstop, not the invalidation strategy: publishing explicitly
 * deletes the key, and the TTL only bounds staleness if that delete never lands.
 * Everything here fails open toward the database — an absent (null) or
 * unreachable cache degrades to a direct read rather than a public outage.
 */

import {
  createCachePortFromEnv,
  readThrough,
  type CachePort,
} from "@wedding/cache";
import type { PublicPublication } from "@wedding/database";

export const PUBLIC_INVITATION_CACHE_TTL_SECONDS = 60;

export function publicInvitationCacheKey(slug: string): string {
  return `wedding:${slug}`;
}

export function getPublicInvitationCache(): CachePort | null {
  return createCachePortFromEnv(process.env);
}

export function readPublicPublication(input: {
  slug: string;
  load: () => Promise<PublicPublication | null>;
  cache?: CachePort | null;
}): Promise<PublicPublication | null> {
  const cache =
    input.cache === undefined ? getPublicInvitationCache() : input.cache;
  return readThrough<PublicPublication | null>({
    cache,
    key: publicInvitationCacheKey(input.slug),
    ttlSeconds: PUBLIC_INVITATION_CACHE_TTL_SECONDS,
    load: input.load,
  });
}

export async function invalidatePublicInvitation(
  slug: string,
  cache: CachePort | null = getPublicInvitationCache(),
): Promise<void> {
  if (cache === null) return;
  try {
    await cache.delete(publicInvitationCacheKey(slug));
  } catch {
    // Best-effort: the backstop TTL bounds staleness if the delete fails.
  }
}
