/**
 * Appointment pass check-in rules shared by the QR scanner and its server functions.
 * The patient app encodes passes as `CAREPULSE|<reference code>|<secret token>`.
 * The secret token must never be returned to the browser or shown on screen.
 */

/** Clinic roles allowed to check patients in with a QR pass. */
export const PASS_SCANNER_ROLES = ["admin", "receptionist"];

/** Clinic calendar used for "appointment day" checks (matches the reminder job). */
export const CLINIC_TIME_ZONE = "Africa/Lagos";

/** Passes are only accepted on the appointment day itself. */
export const SAME_DAY_CHECK_IN_ONLY = true;

export type PassQr = { referenceCode: string; token: string };

export function parsePassQr(raw: unknown): PassQr | null {
  if (typeof raw !== "string" || raw.length > 512) return null;
  const parts = raw.trim().split("|");
  if (parts.length !== 3) return null;
  const [prefix, referenceCode, token] = parts;
  if (prefix !== "CAREPULSE" || !referenceCode || !token) return null;
  if (!/^CP-[A-Z0-9-]{1,40}$/.test(referenceCode)) return null;
  if (!/^[A-Za-z0-9_-]{8,256}$/.test(token)) return null;
  return { referenceCode, token };
}

export function canScanPasses(roles: string[]) {
  return roles.some((role) => PASS_SCANNER_ROLES.includes(role.trim().toLowerCase()));
}

export function clinicDateKey(now: Date, timeZone = CLINIC_TIME_ZONE) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export type PassRejectionReason =
  | "unreadable"
  | "invalid"
  | "wrong_clinic"
  | "not_authorised"
  | "expired"
  | "cancelled"
  | "already_checked_in"
  | "not_confirmed"
  | "not_today";

export const passRejectionTitles: Record<PassRejectionReason, string> = {
  unreadable: "Not a CarePulse pass",
  invalid: "Pass not recognised",
  wrong_clinic: "Pass for a different clinic",
  not_authorised: "Not authorised to check in",
  expired: "Pass expired",
  cancelled: "Appointment cancelled",
  already_checked_in: "Already checked in",
  not_confirmed: "Appointment not confirmed",
  not_today: "Not today's appointment",
};

export const passRejectionMessages: Record<PassRejectionReason, string> = {
  unreadable: "This QR code isn't a CarePulse appointment pass.",
  invalid: "This pass couldn't be verified for your clinic. Ask the patient to reopen their pass in the CarePulse app.",
  wrong_clinic: "This pass belongs to another clinic. Switch to that clinic before checking the patient in.",
  not_authorised: "Only clinic admins and reception staff can check patients in with a QR pass.",
  expired: "This pass has expired, so it can't be used for check-in.",
  cancelled: "This appointment was cancelled, so the pass can't be used.",
  already_checked_in: "This patient is already checked in. Each pass can only be used once.",
  not_confirmed: "This appointment isn't confirmed yet. Confirm it from Appointments first.",
  not_today: "This pass is for another day. Patients can only be checked in on the day of their appointment.",
};

export function evaluatePassEligibility(input: {
  status: string | null;
  expiresAt: string | null;
  appointmentDate: string;
  now: Date;
  sameDayOnly?: boolean;
}): PassRejectionReason | null {
  const status = (input.status ?? "").trim().toLowerCase();
  const today = clinicDateKey(input.now);
  if (status === "cancelled") return "cancelled";
  if (status === "checked_in" || status === "completed") return "already_checked_in";
  if (input.expiresAt && new Date(input.expiresAt).getTime() <= input.now.getTime()) return "expired";
  if (input.appointmentDate < today) return "expired";
  if (status !== "confirmed") return "not_confirmed";
  if ((input.sameDayOnly ?? SAME_DAY_CHECK_IN_ONLY) && input.appointmentDate > today) return "not_today";
  return null;
}

/** Appointment details shown to staff after a scan. Never contains the pass token or contact details. */
export type PassDetails = {
  referenceCode: string;
  patientName: string;
  clinicName: string;
  appointmentDate: string;
  appointmentTime: string;
  doctorName: string | null;
  reason: string | null;
  status: string;
};

export type PassScanResult =
  | { outcome: "verified"; pass: PassDetails }
  | { outcome: "checked_in"; pass: PassDetails }
  | { outcome: "rejected"; reason: PassRejectionReason; message: string; pass: PassDetails | null };

/** Database access the scanner needs; implemented with the signed-in staff member's RLS client. */
export interface PassGateway {
  rolesForClinic(clinicId: string): Promise<string[]>;
  verifyToken(referenceCode: string, token: string): Promise<boolean>;
  findPass(referenceCode: string, token: string): Promise<{ clinicId: string; appointmentId: string; patientId: string; referenceCode: string; expiresAt: string | null } | null>;
  findAppointment(appointmentId: string, clinicId: string): Promise<{ id: string; patientId: string; doctorId: string | null; date: string; time: string; reason: string | null; status: string | null } | null>;
  describe(input: { clinicId: string; patientId: string; doctorId: string | null }): Promise<{ patientName: string | null; doctorName: string | null; clinicName: string | null }>;
  /** Moves a confirmed appointment to checked_in; returns false when it was not confirmed any more. */
  checkIn(appointmentId: string, clinicId: string): Promise<boolean>;
}

export const PASS_SERVICE_ERROR = "The pass could not be checked right now. Please try again.";

type Resolved = { ok: true; pass: PassDetails; appointmentId: string } | { ok: false; result: PassScanResult };

function reject(reason: PassRejectionReason, pass: PassDetails | null = null): Resolved {
  return { ok: false, result: { outcome: "rejected", reason, message: passRejectionMessages[reason], pass } };
}

async function resolveScannedPass(gateway: PassGateway, input: { clinicId: string; qrText: string }, now: Date): Promise<Resolved> {
  const qr = parsePassQr(input.qrText);
  if (!qr) return reject("unreadable");
  if (!canScanPasses(await gateway.rolesForClinic(input.clinicId))) return reject("not_authorised");
  if (!(await gateway.verifyToken(qr.referenceCode, qr.token))) return reject("invalid");
  const pass = await gateway.findPass(qr.referenceCode, qr.token);
  if (!pass) return reject("invalid");
  if (pass.clinicId !== input.clinicId) return reject("wrong_clinic");
  const appointment = await gateway.findAppointment(pass.appointmentId, pass.clinicId);
  if (!appointment || appointment.patientId !== pass.patientId) return reject("invalid");
  const names = await gateway.describe({ clinicId: pass.clinicId, patientId: pass.patientId, doctorId: appointment.doctorId });
  const details: PassDetails = {
    referenceCode: pass.referenceCode,
    patientName: names.patientName ?? "Patient",
    clinicName: names.clinicName ?? "Your clinic",
    appointmentDate: appointment.date,
    appointmentTime: appointment.time,
    doctorName: names.doctorName,
    reason: appointment.reason,
    status: (appointment.status ?? "pending").trim().toLowerCase(),
  };
  const problem = evaluatePassEligibility({ status: appointment.status, expiresAt: pass.expiresAt, appointmentDate: appointment.date, now });
  if (problem) return reject(problem, details);
  return { ok: true, pass: details, appointmentId: appointment.id };
}

export async function verifyScannedPass(gateway: PassGateway, input: { clinicId: string; qrText: string }, now: Date): Promise<PassScanResult> {
  const resolved = await resolveScannedPass(gateway, input, now);
  return resolved.ok ? { outcome: "verified", pass: resolved.pass } : resolved.result;
}

export async function checkInScannedPass(gateway: PassGateway, input: { clinicId: string; qrText: string }, now: Date): Promise<PassScanResult> {
  const resolved = await resolveScannedPass(gateway, input, now);
  if (!resolved.ok) return resolved.result;
  const updated = await gateway.checkIn(resolved.appointmentId, input.clinicId);
  if (updated) return { outcome: "checked_in", pass: { ...resolved.pass, status: "checked_in" } };
  // Someone else changed the visit between the check and the update (e.g. a second scan).
  const again = await resolveScannedPass(gateway, input, now);
  if (!again.ok) return again.result;
  throw new Error(PASS_SERVICE_ERROR);
}
