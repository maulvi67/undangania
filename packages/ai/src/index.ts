export type AiDraft<T> = {
  draft: T;
  model: string;
  promptVersion: string;
  warnings: string[];
  requiresHumanApproval: true;
};
export interface AiGenerationPort {
  generateContent(input: {
    tenantId: string;
    facts: Record<string, string>;
    tone: string;
    locale: string;
    maxOutputChars: number;
  }): Promise<AiDraft<string>>;
}
