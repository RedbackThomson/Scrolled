import { z } from 'zod';
import type { ServerProfile } from './types';

// Validation boundary for profile data that arrives as plain JSON (bundled
// from the profiles directory, or — later — imported by the user). A profile
// is inert data: it can only declare rates and reference calculators by id,
// never carry executable code. Unknown keys are stripped rather than rejected
// so a profile authored against a newer build still loads on an older one.
const fingerprintSchema = z.object({
  file: z.string().min(1),
  path: z.string().min(1),
  contains: z.string().min(1),
});

export const serverProfileSchema: z.ZodType<ServerProfile, z.ZodTypeDef, unknown> = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  rates: z
    .object({
      exp: z.number().positive().optional(),
    })
    .default({}),
  systems: z
    .object({
      equipStatCalculation: z.string().optional(),
    })
    .default({}),
  fingerprints: z.array(fingerprintSchema).optional(),
});
