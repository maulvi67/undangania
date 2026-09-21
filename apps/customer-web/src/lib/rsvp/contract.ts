export const RSVP_RESPONSES = ["ATTENDING", "DECLINED", "TENTATIVE"] as const;

export type RsvpResponse = (typeof RSVP_RESPONSES)[number];

export type RsvpAnswer = Readonly<{
  response: RsvpResponse;
  pax: number;
  optimisticVersion: number;
}>;

export type RsvpDraftAnswer = Readonly<{
  response: RsvpResponse | null;
  pax: number | null;
}>;

export type RsvpDraft = Readonly<Record<string, RsvpDraftAnswer>>;

export type RsvpUpdate = Readonly<{
  eventId: string;
  response: RsvpResponse;
  pax: number;
  expectedVersion: number | null;
}>;

export type RsvpSubmitCommand = Readonly<{
  updates: readonly RsvpUpdate[];
  idempotencyKey: string;
}>;

export type RsvpSubmissionSuccess = Readonly<{
  kind: "success";
  answers: readonly RsvpAnswer[];
  message: string;
}>;

export type RsvpSubmissionErrorCode =
  | "SUBMISSION_FAILED"
  | "STALE_VERSION"
  | "RATE_LIMITED"
  | "IDEMPOTENCY_CONFLICT"
  | "PAUSED"
  | "EXPIRED";

export type RsvpSubmissionError = Readonly<{
  kind: "error";
  code: RsvpSubmissionErrorCode;
  message: string;
  eventId?: string;
  preserveInput: true;
  retryAfterSeconds?: number;
}>;

export type RsvpSubmissionResult = RsvpSubmissionSuccess | RsvpSubmissionError;

export type RsvpTransport = Readonly<{
  submit(command: RsvpSubmitCommand): Promise<RsvpSubmissionResult>;
}>;

export function responseLabel(response: RsvpResponse): string {
  if (response === "ATTENDING") return "Hadir";
  if (response === "DECLINED") return "Tidak dapat hadir";
  return "Masih tentatif";
}
