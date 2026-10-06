import { z } from 'zod';
import { RELATIONSHIPS } from '@/lib/labels';

export const phoneRegex = /^[+0-9][0-9 .\-()]{6,19}$/;

export const guardianSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required').max(120),
  relationship: z.enum(RELATIONSHIPS, { errorMap: () => ({ message: 'Relationship is required' }) }),
  phone: z.string().trim().min(1, 'Phone is required').regex(phoneRegex, 'Enter a valid phone number'),
  email: z.union([z.literal(''), z.string().trim().email('Enter a valid email')]).optional(),
  isPrimary: z.boolean().optional(),
});
export type GuardianForm = z.infer<typeof guardianSchema>;
