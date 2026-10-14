import { z } from 'zod';
import type { MessageKey } from '@/lib/i18n';
import { RELATIONSHIPS } from '@/lib/labels';

export const phoneRegex = /^[+0-9][0-9 .\-()]{6,19}$/;

export const makeGuardianSchema = (t: (key: MessageKey) => string) =>
  z.object({
    fullName: z.string().trim().min(1, t('patients.fullNameRequired')).max(120),
    relationship: z.enum(RELATIONSHIPS, { errorMap: () => ({ message: t('patients.relationshipRequired') }) }),
    phone: z.string().trim().min(1, t('patients.phoneRequired')).regex(phoneRegex, t('patients.phoneInvalid')),
    email: z.union([z.literal(''), z.string().trim().email(t('patients.emailInvalid'))]).optional(),
    isPrimary: z.boolean().optional(),
  });
export type GuardianForm = z.infer<ReturnType<typeof makeGuardianSchema>>;
