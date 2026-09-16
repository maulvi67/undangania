import type { TenantContext } from "@wedding/domain";

export interface UnitOfWork {
  transaction<T>(work: () => Promise<T>): Promise<T>;
}

export interface AuthorizationPort {
  assert(
    context: TenantContext,
    permission: string,
    resourceId: string,
  ): Promise<void>;
}

export interface AuditPort {
  append(event: {
    tenantId?: string;
    actorId: string;
    action: string;
    targetId: string;
    reason?: string;
  }): Promise<void>;
}
export {
  ApplicationError,
  AuthRequiredError,
  ForbiddenError,
  TenantMismatchError,
  type ApplicationErrorCode,
} from "./errors";
export {
  createRequestAuthContext,
  hasAnyRole,
  hasRole,
  requireAnyRole,
  requireAuthenticated,
  requireRole,
  requireTenant,
  toTenantContext,
  MEMBER_ROLES,
  type MemberRole,
  type RequestAuthContext,
  type RequestAuthContextInput,
  type TenantRequestAuthContext,
} from "./auth-context";
export {
  assertAnyRole,
  ConflictError,
  EntitlementLimitReachedError,
  InvalidInputError,
  isCalendarDate,
  isNonEmptyText,
  NotFoundError,
  NotImplementedError,
  ProviderUnavailableError,
  requireTenantContext,
  StaleVersionError,
  UnavailableError,
  UseCaseError,
  ADMIN_ROLES,
  EDITOR_ROLES,
  FINANCE_ROLES,
  OWNER_ROLES,
  type UseCaseErrorCode,
} from "./use-case-support";
export {
  applyPromotionRule,
  createCheckout,
  findCheckoutPayment,
  type CheckoutOrder,
  type CheckoutPayment,
  type CheckoutPorts,
  type CheckoutPricingPort,
  type CheckoutPromotion,
  type CheckoutPromotionPort,
  type CheckoutPromotionRule,
  type CheckoutProviderPort,
  type CheckoutScope,
  type CheckoutTransactionPort,
  type CreateCheckoutInput,
  type CreateCheckoutResult,
} from "./checkout";
export {
  loadEditorDocument,
  publishInvitation,
  saveEditorDocument,
  type EditorDocument,
  type EditorInvitation,
  type EditorLoadPort,
  type EditorPorts,
  type EditorScope,
  type EditorTemplate,
  type PublishResult,
} from "./editor";
export {
  completeOnboarding,
  loadOnboarding,
  onboardingIssues,
  saveOnboardingStep,
  type OnboardingData,
  type OnboardingDraft,
  type OnboardingPort,
  type OnboardingPorts,
  type OnboardingScope,
} from "./onboarding";
export {
  DEFAULT_ADMIN_LIMIT,
  isPlatformAdmin,
  isPlatformSection,
  loadAdminSection,
  PLATFORM_SECTIONS,
  type AdminAuditRow,
  type AdminPlatformPort,
  type AdminPorts,
  type AdminQueryScope,
  type AdminRow,
  type AdminSection,
  type AdminTenantScopedPort,
  type LoadAdminSectionInput,
} from "./admin";
export {
  beginMfaEnrolment,
  confirmMfaEnrolment,
  isRecoveryCodeFormat,
  normalizeRecoveryCode,
  normalizeTotpCode,
  readMfaStatus,
  revokeMfa,
  assertMfaEnrolled,
  verifyMfaStepUp,
  type MfaEnrolmentConfirmResult,
  type MfaEnrolmentStart,
  type MfaPort,
  type MfaPorts,
  type MfaRecoveryResult,
  type MfaStatus,
  type MfaVerificationResult,
} from "./mfa";
export {
  completeEmailVerification,
  completePasswordReset,
  notifyPasswordChanged,
  requestEmailVerification,
  requestPasswordReset,
  type AuthEmailPorts,
  type AuthEmailPurpose,
  type AuthAccountPort,
  type AuthNotificationPort,
  type AuthPasswordPort,
  type AuthTokenPort,
  type AuthTokenRedemption,
  type IssuedAuthToken,
  type RequestOutcome,
  type ResetOutcome,
  type VerifyOutcome,
} from "./auth-email";
