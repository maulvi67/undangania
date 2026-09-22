export type MediaActionOutcome =
  | Readonly<{
      kind: "ok";
      assetId: string;
      state:
        | "PENDING_UPLOAD"
        | "UPLOADED"
        | "SCANNING"
        | "PROCESSING"
        | "READY"
        | "REJECTED"
        | "DELETED";
      uploadUrl?: string;
      expiresAt?: string;
    }>
  | Readonly<{ kind: "invalid"; message: string }>
  | Readonly<{ kind: "forbidden" }>
  | Readonly<{ kind: "provider-unavailable"; message: string }>
  | Readonly<{ kind: "not-found" }>
  | Readonly<{ kind: "rejected"; message: string }>
  | Readonly<{ kind: "unavailable" }>;

export type MediaListAsset = Readonly<{
  id: string;
  filename: string;
  mediaType: "IMAGE" | "AUDIO";
  mimeType: string;
  state:
    | "PENDING_UPLOAD"
    | "UPLOADED"
    | "SCANNING"
    | "PROCESSING"
    | "READY"
    | "REJECTED"
    | "DELETED";
  sizeBytes: number;
  width: number | null;
  height: number | null;
  altText: string | null;
  rejectionReason: string | null;
}>;

export type MediaListOutcome =
  | Readonly<{
      kind: "ok";
      assets: readonly MediaListAsset[];
    }>
  | Readonly<{ kind: "forbidden" }>
  | Readonly<{ kind: "unavailable" }>;
