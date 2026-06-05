import type { MarksheetQuestion, MarksheetSchema, MarksheetScoringRule } from "@/types/exam";

export type MarksheetSubmissionPayload = {
  mode?: string;
  answers?: Record<string, string>;
  selectedSectionIds?: string[];
};

export function hasAnswerValue(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

export function matchesVariant(variant: string[], actual: string[], orderMatters = true) {
  if (variant.length !== actual.length) return false;

  if (!orderMatters) {
    const expectedSorted = [...variant].sort();
    const actualSorted = [...actual].sort();
    return expectedSorted.every((expected, index) => expected === "*" || expected === actualSorted[index]);
  }

  return variant.every((expected, index) => expected === "*" || expected === actual[index]);
}

export function matchesScoringRule(rule: MarksheetScoringRule, actual: string[]) {
  return rule.acceptedVariants.some((variant) => matchesVariant(variant, actual, rule.orderMatters !== false));
}

export function getAwardedPoints(rule: MarksheetScoringRule, actual: string[]) {
  if (matchesScoringRule(rule, actual)) return rule.points;
  const partial = rule.partialCredit?.find((entry) =>
    entry.acceptedVariants.some((variant) =>
      matchesVariant(variant, actual, entry.orderMatters ?? (rule.orderMatters !== false)),
    ),
  );
  return partial?.points ?? 0;
}

export function buildFallbackScoringRules(schema: MarksheetSchema): MarksheetScoringRule[] {
  return schema.questions
    .filter((question) => hasAnswerValue(question.correctAnswer))
    .map((question) => ({
      id: question.id,
      title: question.prompt,
      questionIds: [question.id],
      acceptedVariants: [[String(question.correctAnswer)]],
      points: question.points ?? 1,
      sectionId: question.sectionId,
    }));
}

export function buildEffectiveScoringRules(schema: MarksheetSchema): MarksheetScoringRule[] {
  const explicitRules = schema.scoringRules ?? [];
  if (!explicitRules.length) return buildFallbackScoringRules(schema);

  const coveredQuestionIds = new Set(explicitRules.flatMap((rule) => rule.questionIds));
  const fallbackRules = buildFallbackScoringRules(schema).filter(
    (rule) => !rule.questionIds.some((questionId) => coveredQuestionIds.has(questionId)),
  );
  return [...explicitRules, ...fallbackRules];
}

export function getSelectionBounds(group: { sectionIds: string[]; minSelect?: number; maxSelect?: number }) {
  const maxSelect = group.maxSelect ?? group.minSelect ?? group.sectionIds.length;
  const minSelect = group.minSelect ?? maxSelect;
  return { minSelect, maxSelect };
}

export function resolveSelectedSectionIds(schema: MarksheetSchema, selectedSectionIds: string[] = []) {
  const selected = new Set(selectedSectionIds);
  const groups = schema.selectionGroups ?? [];
  if (!groups.length) return selected;

  groups.forEach((group) => {
    const { minSelect, maxSelect } = getSelectionBounds(group);
    const selectedInGroup = group.sectionIds.filter((sectionId) => selected.has(sectionId));
    if (selectedInGroup.length >= minSelect && selectedInGroup.length <= maxSelect) return;

    selectedInGroup.slice(maxSelect).forEach((sectionId) => selected.delete(sectionId));
    if (selectedInGroup.length < minSelect) {
      group.sectionIds
        .filter((sectionId) => !selected.has(sectionId))
        .slice(0, minSelect - selectedInGroup.length)
        .forEach((sectionId) => selected.add(sectionId));
    }
  });

  return selected;
}

export function getActiveQuestions(schema: MarksheetSchema, selectedSectionIds: string[] = []) {
  const selectableSectionIds = new Set(schema.selectionGroups?.flatMap((group) => group.sectionIds) ?? []);
  const selected = resolveSelectedSectionIds(schema, selectedSectionIds);
  return schema.questions.filter(
    (question) =>
      !question.sectionId ||
      !selectableSectionIds.has(question.sectionId) ||
      selected.has(question.sectionId),
  );
}

export function getAnsweredCount(questions: MarksheetQuestion[], answers: Record<string, string>) {
  return questions.filter((question) => hasAnswerValue(answers[question.id])).length;
}

export function getDisplayCorrectAnswers(rule: MarksheetScoringRule, actual: string[]) {
  const matchedVariant =
    rule.acceptedVariants.find((variant) => matchesVariant(variant, actual, rule.orderMatters !== false)) ??
    rule.acceptedVariants[0] ??
    [];

  if (rule.orderMatters !== false) return matchedVariant;

  const remaining = [...matchedVariant];
  return actual.map((answer) => {
    const exactIndex = remaining.indexOf(answer);
    if (exactIndex >= 0) return remaining.splice(exactIndex, 1)[0];
    const wildcardIndex = remaining.indexOf("*");
    if (wildcardIndex >= 0) return remaining.splice(wildcardIndex, 1)[0];
    return remaining.shift() ?? "";
  });
}

export function parseMarksheetSubmission(content: string): MarksheetSubmissionPayload | null {
  try {
    const parsed = JSON.parse(content) as MarksheetSubmissionPayload;
    if (parsed && typeof parsed === "object" && parsed.mode === "marksheet" && parsed.answers) return parsed;
  } catch {
    return null;
  }
  return null;
}
