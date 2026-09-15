export { createPrismaClient, getPrismaClient, prisma } from "./client";
export {
  hashPassword,
  isPasswordHash,
  PASSWORD_HASH_FORMAT,
  verifyPassword,
} from "./password";
export {
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

export type RepositoryContext = Readonly<{
  tenantId: string;
  actorId: string;
}>;

export interface TenantScopedRepository<T> {
  findById(context: RepositoryContext, id: string): Promise<T | null>;
}
