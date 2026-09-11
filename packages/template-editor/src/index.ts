import {
  invitationViewModelSchema,
  type InvitationViewModel,
  type TemplateManifest,
} from "@wedding/template-engine";

export type SectionOrderPolicy = {
  readonly allowedOrder: readonly string[];
  readonly reorderableSections: readonly string[];
};

export function validateDraft(input: unknown): InvitationViewModel {
  return invitationViewModelSchema.parse(input);
}

function sameOrder(left: readonly string[], right: readonly string[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function policyFromManifest(
  manifest: TemplateManifest,
): SectionOrderPolicy | null {
  if (!manifest.sectionOrder || !manifest.reorderableSections) return null;
  return {
    allowedOrder: manifest.sectionOrder,
    reorderableSections: manifest.reorderableSections,
  };
}

export function canReorderSection(
  model: InvitationViewModel,
  from: number,
  to: number,
  policy?: SectionOrderPolicy,
): boolean {
  if (!Number.isInteger(from) || !Number.isInteger(to)) return false;
  if (
    from < 0 ||
    to < 0 ||
    from >= model.sections.length ||
    to >= model.sections.length
  )
    return false;
  if (from === to) return false;

  const moving = model.sections[from];
  const target = model.sections[to];
  if (!moving || !target) return false;
  if (!policy) return true;
  if (!policy.reorderableSections.includes(moving.type)) return false;
  if (!policy.reorderableSections.includes(target.type)) return false;

  const next = [...model.sections];
  const [item] = next.splice(from, 1);
  if (!item) return false;
  next.splice(to, 0, item);
  return sameOrder(
    next.map((section) => section.type),
    policy.allowedOrder,
  );
}

/**
 * Reorders only when the move is valid for the supplied manifest policy.
 * Without a policy this retains the original safe array operation for older
 * renderers; production editor callers should always provide the policy.
 */
export function reorderSection(
  model: InvitationViewModel,
  from: number,
  to: number,
  policy?: SectionOrderPolicy,
): InvitationViewModel {
  if (policy && !canReorderSection(model, from, to, policy)) return model;
  if (
    !policy &&
    (from === to ||
      from < 0 ||
      to < 0 ||
      from >= model.sections.length ||
      to >= model.sections.length)
  ) {
    return model;
  }

  const sections = [...model.sections];
  const [item] = sections.splice(from, 1);
  if (!item) return model;
  sections.splice(to, 0, item);
  return { ...model, sections };
}

export function reorderSectionForManifest(
  model: InvitationViewModel,
  from: number,
  to: number,
  manifest: TemplateManifest,
): InvitationViewModel {
  const policy = policyFromManifest(manifest);
  return policy ? reorderSection(model, from, to, policy) : model;
}
