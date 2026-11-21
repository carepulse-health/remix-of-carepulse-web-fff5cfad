import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { checkInScannedPass, verifyScannedPass } from "./carepulse-pass";
import { createPassGateway } from "./carepulse-pass.server";

const scanInput = z.object({
  clinicId: z.string().uuid(),
  qrText: z.string().min(1).max(512),
});

/** Verifies a scanned patient pass on the server and returns appointment details without the token. */
export const verifyPatientPass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => scanInput.parse(input))
  .handler(async ({ data, context }) => verifyScannedPass(createPassGateway(context.supabase, context.userId), data, new Date()));

/** Re-verifies the pass and checks the patient in once; repeat scans are refused. */
export const checkInPatientPass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => scanInput.parse(input))
  .handler(async ({ data, context }) => checkInScannedPass(createPassGateway(context.supabase, context.userId), data, new Date()));
