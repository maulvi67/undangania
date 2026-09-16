export { createPrismaClient, getPrismaClient, prisma } from "./client";
export {
  hashPassword,
  isPasswordHash,
  PASSWORD_HASH_FORMAT,
  verifyPassword,
} from "./password";
export {
  DEFAULT_WEDDING_DISPLAY_NAME,
  PrismaUserAuthRepository,
  UserAuthInputError,
  UserAuthRegistrationError,
  type RegisteredUserAuth,
  type RegisterUserInput,
  type UserAuthRecord,
  type UserAuthRepository,
} from "./repositories/user-auth";
export {
  generateOpaqueToken,
  generateSessionToken,
  hashToken,
  hashSessionToken,
  verifyToken,
  verifySessionToken,
  type OpaqueToken,
} from "./tokens";
export {
  PrismaSessionRepository,
  type CreatedSession,
  type SessionDto,
  type SessionRepository,
} from "./repositories/session";
export {
  PrismaTenantMembershipRepository,
  type TenantMembershipDto,
  type TenantMembershipRepository,
  type TenantMembershipScope,
} from "./repositories/membership";
export {
  PrismaGuestHouseholdRepository,
  type GuestHouseholdCreateInput,
  type GuestHouseholdDto,
  type GuestHouseholdListOptions,
  type GuestHouseholdMutationRepository,
  type GuestHouseholdRepository,
  type GuestHouseholdUpdateInput,
  type TenantWeddingScope,
} from "./repositories/guest-household";
export {
  DatabaseRepositoryUnavailableError,
  PrismaQrisNotificationTransaction,
} from "./repositories/qris-notification";
export {
  PrismaOrderPaymentRepository,
  type OrderPaymentDto,
  type OrderPaymentRepository,
  type OrderPaymentScope,
} from "./repositories/order-payment";
export {
  CheckoutValidationError,
  generateOrderNumber,
  isOrderNumber,
  ORDER_NUMBER_PATTERN,
  parsePromotionRule,
  PrismaCheckoutOrderRepository,
  PrismaCheckoutPaymentRepository,
  PrismaCheckoutPricingRepository,
  PrismaCheckoutPromotionRepository,
  PrismaCheckoutTransaction,
  type CheckoutOrderDto,
  type CheckoutOrderItemDto,
  type CheckoutOrderRepository,
  type CheckoutPaymentDto,
  type CheckoutPaymentRepository,
  type CheckoutPricingRepository,
  type CheckoutPromotionDto,
  type CheckoutPromotionRepository,
  type CheckoutPromotionRule,
  type CheckoutRepositories,
  type CheckoutScope,
  type CheckoutTransactionPort,
  type CheckoutValidationCode,
} from "./repositories/checkout";
export {
  adaptEditorClient,
  isJsonValue,
  isPublishableStatus,
  nextPublicationVersion,
  PrismaEditorRepository,
  PrismaEditorTransaction,
  readContractVersion,
  type EditorDocumentDto,
  type EditorInvitationDto,
  type EditorLoadDto,
  type EditorPublishInput,
  type EditorPublishResult,
  type EditorRepositories,
  type EditorRepository,
  type EditorSaveInput,
  type EditorSaveResult,
  type EditorScope,
  type EditorTemplateDto,
  type EditorTransactionClient,
  type EditorTransactionPort,
} from "./repositories/invitation-editor";
export {
  combineEventStartsAt,
  fromYmd,
  PrismaOnboardingRepository,
  PrismaOnboardingTransaction,
  toContractLocale,
  toDbLocale,
  toYmd,
  type OnboardingCompleteInput,
  type OnboardingCompleteResult,
  type OnboardingDataDto,
  type OnboardingDraftDto,
  type OnboardingRepositories,
  type OnboardingRepository,
  type OnboardingRepositoryClient,
  type OnboardingSaveStepInput,
  type OnboardingSaveStepResult,
  type OnboardingScope,
  type OnboardingStepId,
  type OnboardingTransactionPort,
} from "./repositories/onboarding";
export {
  adaptAuthTokenClient,
  AUTH_TOKEN_TYPES,
  classifyAuthToken,
  isAuthTokenType,
  isWellFormedAuthToken,
  MIN_AUTH_TOKEN_LENGTH,
  PrismaAuthTokenRepository,
  type AuthTokenRedemption,
  type AuthTokenRepository,
  type AuthTokenTransactionClient,
  type AuthTokenType,
  type IssuedAuthToken,
} from "./repositories/auth-token";
export {
  adaptMfaClient,
  createMfaRepositoryFromEnv,
  isReplayedStep,
  lastUsedStep,
  PrismaMfaRepository,
  PrismaMfaTransaction,
  type MfaEnrolmentConfirmResult,
  type MfaEnrolmentStart,
  type MfaRecoveryResult,
  type MfaRepositories,
  type MfaRepository,
  type MfaStatus,
  type MfaTransactionClient,
  type MfaTransactionPort,
  type MfaVerificationResult,
} from "./repositories/mfa";
export {
  adaptAdminOperationsClient,
  decimalString,
  escalationStateForStuck,
  failureStageFor,
  formatAge,
  formatDuration,
  isPrintingStuck,
  maskIdentifier,
  maskRecipientRef,
  MAX_DELIVERY_ATTEMPTS,
  PrismaAdminOperationsRepository,
  queueFor,
  reconciliationState,
  retryStateFor,
  severityForPayment,
  shippingStatusFor,
  type AdminAuditRowDto,
  type AdminFailedJobRowDto,
  type AdminLifecycleExceptionRowDto,
  type AdminLifecycleRowDto,
  type AdminOperationsClient,
  type AdminOperationsRepository,
  type AdminOperationsScope,
  type AdminPaymentRowDto,
  type AdminPrintingRowDto,
  type AdminPublicationFailureRowDto,
  type AdminSeverity,
  type AdminSupportRowDto,
  type AdminTemplateStatusRowDto,
} from "./repositories/admin-operations";
export {
  adaptWeddingWorkspaceClient,
  PrismaWeddingWorkspaceRepository,
  type InvitationRef,
  type WeddingWorkspaceRepository,
  type WorkspaceRef,
} from "./repositories/wedding-workspace";
export {
  adaptInvitationProvisioningClient,
  buildInvitationSlug,
  PrismaInvitationProvisioningRepository,
  type InvitationProvisionResult,
  type InvitationProvisioningRepository,
  type ProvisionedInvitation,
} from "./repositories/invitation-provisioning";
export {
  adaptTemplateCatalogueClient,
  PrismaTemplateCatalogueRepository,
  TemplateCatalogueInputError,
  type TemplateCatalogueEntry,
  type TemplateCatalogueRepository,
} from "./repositories/template-catalogue";
export {
  adaptPublicationReaderClient,
  isPublicSlug,
  PrismaPublicationReaderRepository,
  type PublicPublication,
  type PublicationReaderRepository,
} from "./repositories/publication-reader";
export {
  buildTotpUri,
  decodeBase32,
  encodeBase32,
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  MFA_RECOVERY_CODE_COUNT,
  MFA_TOTP_CONFIG,
  normalizeRecoveryCode,
  openTotpSecret,
  sealTotpSecret,
  totpForStep,
  totpStepAt,
  verifyTotp,
  type GeneratedRecoveryCodes,
} from "./mfa";

export type RepositoryContext = Readonly<{
  tenantId: string;
  actorId: string;
}>;

export interface TenantScopedRepository<T> {
  findById(context: RepositoryContext, id: string): Promise<T | null>;
}
