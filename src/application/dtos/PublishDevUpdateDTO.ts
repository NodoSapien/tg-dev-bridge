import { z } from "zod";

export const publishDevUpdateSchema = z.object({
  completedChanges: z
    .array(z.string().min(1, "El cambio no puede estar vacío"))
    .min(1, "Debe proveer al menos un cambio realizado"),
  nextSteps: z
    .array(z.string().min(1, "El siguiente paso no puede estar vacío"))
    .min(1, "Debe proveer al menos un siguiente paso"),
  blockers: z
    .array(z.string().min(1, "El bloqueo no puede estar vacío"))
    .optional(),
  customAuthor: z.string().min(1).optional(),
});

export type PublishDevUpdateInput = z.infer<typeof publishDevUpdateSchema>;
