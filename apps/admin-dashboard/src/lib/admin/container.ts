import { PrismaAdminOperationsRepository } from "@wedding/database";
import {
  PLATFORM_SECTIONS,
  type AdminPlatformPort,
  type AdminPorts,
  type AdminQueryScope,
  type AdminTenantScopedPort,
} from "@wedding/application";

/**
 * Composition root for the admin console read use-cases.
 *
 * The repository's DTOs carry every field the console renders, and each is a
 * structural superset of the port's row type, so no projection is needed: the
 * section-specific columns ride along untouched and the console keeps its
 * per-section detail fields without this adapter enumerating them.
 */

function tenantScopedPort(): AdminTenantScopedPort {
  const repository = new PrismaAdminOperationsRepository();

  return {
    loadPayments: (scope: AdminQueryScope) => repository.loadPayments(scope),
    loadPrinting: (scope: AdminQueryScope) => repository.loadPrinting(scope),
    loadSupport: (scope: AdminQueryScope) => repository.loadSupport(scope),
    loadPublicationFailures: (scope: AdminQueryScope) =>
      repository.loadPublicationFailures(scope),
    loadLifecycle: (scope: AdminQueryScope) => repository.loadLifecycle(scope),
  };
}

function platformPort(): AdminPlatformPort {
  const repository = new PrismaAdminOperationsRepository();

  return {
    loadFailedJobs: (scope: AdminQueryScope) =>
      repository.loadFailedJobs(scope),
    loadTemplates: (scope: AdminQueryScope) => repository.loadTemplates(scope),
    loadAudit: (scope: AdminQueryScope) => repository.loadAudit(scope),
  };
}

export function getAdminPorts(): AdminPorts {
  return {
    tenantScoped: tenantScopedPort(),
    platform: platformPort(),
    // Shared with the application layer so the authorization check and the
    // routing cannot disagree about which sections are privileged.
    platformSections: PLATFORM_SECTIONS,
  };
}
