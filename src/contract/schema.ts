import { z } from 'zod/v4';

/**
 * Experimental v0 activity contract.
 *
 * This file is the TypeScript source of truth. `contracts/experimental-v0/activity.schema.json`
 * is generated from it (see `scripts/emit-schema.ts`) so that non-TypeScript consumers can
 * validate the same shape. Unknown fields are tolerated and stripped so that later versions
 * can add fields without breaking v0 readers.
 */
export const CONTRACT_ID = 'wordmine.activity.v0' as const;

const nonEmpty = () => z.string().trim().min(1, 'Must not be empty');

/** BCP 47 language tag such as "en", "en-GB" or "zh-Hans". */
export const LanguageTagSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$/, 'Expected a BCP 47 language tag such as "en" or "zh-Hans"')
  .meta({ id: 'LanguageTag', description: 'BCP 47 language tag' });

/** Every learner-visible string carries its own language tag. */
export const LocalizedTextSchema = z
  .object({ lang: LanguageTagSchema, text: nonEmpty() })
  .meta({ id: 'LocalizedText', description: 'Learner-visible text with its language tag' });

export const ChoiceSchema = z.object({ id: nonEmpty(), label: LocalizedTextSchema }).meta({ id: 'Choice' });

export const MeaningFromDefinitionSchema = z
  .object({
    id: nonEmpty(),
    kind: z.literal('meaning-from-definition'),
    instruction: LocalizedTextSchema.optional(),
    prompt: LocalizedTextSchema,
    choices: z.array(ChoiceSchema).min(2, 'At least two choices are required').max(8, 'At most eight choices are allowed'),
  })
  .superRefine((activity, ctx) => {
    const seen = new Set<string>();
    activity.choices.forEach((choice, index) => {
      if (seen.has(choice.id)) {
        ctx.addIssue({ code: 'custom', message: `Duplicate choice id "${choice.id}"`, path: ['choices', index, 'id'] });
      }
      seen.add(choice.id);
    });
  })
  .meta({ id: 'MeaningFromDefinitionActivity' });

/** Discriminated on `kind`; new activity families are added here, not as new contracts. */
export const ActivityDefinitionSchema = z.discriminatedUnion('kind', [MeaningFromDefinitionSchema]);

/** Grading data, kept apart from the definition so a prompt-only document can be shipped alone. */
export const AnswerKeySchema = z.object({
  activityId: nonEmpty(),
  kind: z.literal('meaning-from-definition'),
  choiceId: nonEmpty(),
  feedback: z
    .object({ correct: LocalizedTextSchema.optional(), incorrect: LocalizedTextSchema.optional() })
    .optional(),
}).meta({ id: 'AnswerKey', description: 'Grading data for one activity; may be omitted from a prompt-only document' });

/** UI, target and explanation languages are separate fields by product requirement. */
export const LanguagesSchema = z.object({
  ui: LanguageTagSchema,
  target: LanguageTagSchema,
  explanation: LanguageTagSchema,
}).meta({ id: 'Languages', description: 'UI, target and explanation languages are separate by product requirement' });

export const ActivityDocumentSchema = z
  .object({
    contract: z.literal(CONTRACT_ID),
    contentVersion: nonEmpty(),
    languages: LanguagesSchema,
    activity: ActivityDefinitionSchema,
    answerKey: AnswerKeySchema.optional(),
  })
  .superRefine((document, ctx) => {
    const key = document.answerKey;
    if (!key) return;
    if (key.activityId !== document.activity.id) {
      ctx.addIssue({ code: 'custom', message: 'answerKey.activityId must equal activity.id', path: ['answerKey', 'activityId'] });
    }
    if (key.kind !== document.activity.kind) {
      ctx.addIssue({ code: 'custom', message: 'answerKey.kind must equal activity.kind', path: ['answerKey', 'kind'] });
    }
    if (!document.activity.choices.some((choice) => choice.id === key.choiceId)) {
      ctx.addIssue({ code: 'custom', message: 'answerKey.choiceId must match one of activity.choices[].id', path: ['answerKey', 'choiceId'] });
    }
  });

export type LanguageTag = z.infer<typeof LanguageTagSchema>;
export type LocalizedText = z.infer<typeof LocalizedTextSchema>;
export type Choice = z.infer<typeof ChoiceSchema>;
export type MeaningFromDefinitionActivity = z.infer<typeof MeaningFromDefinitionSchema>;
export type ActivityDefinition = z.infer<typeof ActivityDefinitionSchema>;
export type AnswerKey = z.infer<typeof AnswerKeySchema>;
export type Languages = z.infer<typeof LanguagesSchema>;
export type ActivityDocument = z.infer<typeof ActivityDocumentSchema>;
