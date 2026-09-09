import { invitationViewModelSchema, type InvitationViewModel } from "@wedding/template-engine";
export function validateDraft(input: unknown): InvitationViewModel { return invitationViewModelSchema.parse(input); }
export function reorderSection(model: InvitationViewModel, from: number, to: number): InvitationViewModel { const sections=[...model.sections]; const [item]=sections.splice(from,1); if(!item) return model; sections.splice(to,0,item); return {...model,sections}; }
