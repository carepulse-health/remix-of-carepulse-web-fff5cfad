import { describe, expect, it } from "vitest";
import {
  canScanPasses, checkInScannedPass, evaluatePassEligibility, parsePassQr, verifyScannedPass,
  type PassGateway,
} from "@/lib/carepulse-pass";

const CLINIC = "11111111-1111-4111-8111-111111111111";
const OTHER_CLINIC = "22222222-2222-4222-8222-222222222222";
const TOKEN = "a".repeat(64);
const QR = `CAREPULSE|CP-5475E5EC0BFE|${TOKEN}`;
// 10:00 on 21 Nov 2026 in Lagos.
const NOW = new Date("2026-11-21T09:00:00Z");

function gateway(overrides: { roles?: string[]; valid?: boolean; passClinic?: string; status?: string; date?: string; expiresAt?: string | null } = {}) {
  const state = { status: overrides.status ?? "confirmed", checkIns: 0 };
  const g: PassGateway = {
    rolesForClinic: async () => overrides.roles ?? ["receptionist"],
    verifyToken: async (ref, token) => (overrides.valid ?? true) && ref === "CP-5475E5EC0BFE" && token === TOKEN,
    findPass: async () => ({ clinicId: overrides.passClinic ?? CLINIC, appointmentId: "appt-1", patientId: "patient-1", referenceCode: "CP-5475E5EC0BFE", expiresAt: overrides.expiresAt ?? null }),
    findAppointment: async () => ({ id: "appt-1", patientId: "patient-1", doctorId: null, date: overrides.date ?? "2026-11-21", time: "10:30:00", reason: "Check-up", status: state.status }),
    describe: async () => ({ patientName: "Ada Obi", doctorName: null, clinicName: "CarePulse clinic" }),
    checkIn: async () => {
      if (state.status !== "confirmed") return false;
      state.status = "checked_in";
      state.checkIns += 1;
      return true;
    },
  };
  return { g, state };
}

describe("QR pass check-in", () => {
  it("reads the patient app's CAREPULSE|reference|token format and rejects other codes", () => {
    expect(parsePassQr(QR)).toEqual({ referenceCode: "CP-5475E5EC0BFE", token: TOKEN });
    expect(parsePassQr("https://example.com")).toBeNull();
    expect(parsePassQr(`OTHER|CP-5475E5EC0BFE|${TOKEN}`)).toBeNull();
  });

  it("lets only admins and receptionists scan passes", () => {
    expect(canScanPasses(["admin"])).toBe(true);
    expect(canScanPasses(["receptionist"])).toBe(true);
    expect(canScanPasses(["doctor"])).toBe(false);
  });

  it("refuses doctors before verifying the pass", async () => {
    const { g } = gateway({ roles: ["doctor"] });
    expect(await verifyScannedPass(g, { clinicId: CLINIC, qrText: QR }, NOW)).toMatchObject({ outcome: "rejected", reason: "not_authorised", pass: null });
  });

  it("rejects a pass whose token the database does not verify", async () => {
    const { g } = gateway({ valid: false });
    expect(await verifyScannedPass(g, { clinicId: CLINIC, qrText: QR }, NOW)).toMatchObject({ outcome: "rejected", reason: "invalid", pass: null });
  });

  it("rejects a pass from a different clinic than the one being worked", async () => {
    const { g } = gateway({ passClinic: OTHER_CLINIC });
    expect(await verifyScannedPass(g, { clinicId: CLINIC, qrText: QR }, NOW)).toMatchObject({ outcome: "rejected", reason: "wrong_clinic", pass: null });
  });

  it("rejects cancelled, expired, already-used and unconfirmed passes", () => {
    const base = { expiresAt: null, appointmentDate: "2026-11-21", now: NOW };
    expect(evaluatePassEligibility({ ...base, status: "cancelled" })).toBe("cancelled");
    expect(evaluatePassEligibility({ ...base, status: "checked_in" })).toBe("already_checked_in");
    expect(evaluatePassEligibility({ ...base, status: "completed" })).toBe("already_checked_in");
    expect(evaluatePassEligibility({ ...base, status: "pending" })).toBe("not_confirmed");
    expect(evaluatePassEligibility({ ...base, status: "confirmed", expiresAt: "2026-11-21T08:59:00Z" })).toBe("expired");
    expect(evaluatePassEligibility({ ...base, status: "confirmed", appointmentDate: "2026-11-20" })).toBe("expired");
    expect(evaluatePassEligibility({ ...base, status: "confirmed" })).toBeNull();
  });

  it("only accepts a pass on the appointment day in Lagos time", () => {
    const base = { status: "confirmed", expiresAt: null, now: NOW };
    expect(evaluatePassEligibility({ ...base, appointmentDate: "2026-11-22" })).toBe("not_today");
    // 23:30 UTC on 21 Nov is already 22 Nov in Lagos.
    expect(evaluatePassEligibility({ ...base, appointmentDate: "2026-11-22", now: new Date("2026-11-21T23:30:00Z") })).toBeNull();
  });

  it("checks a patient in once and refuses a second scan of the same pass", async () => {
    const { g, state } = gateway();
    const first = await checkInScannedPass(g, { clinicId: CLINIC, qrText: QR }, NOW);
    expect(first).toMatchObject({ outcome: "checked_in", pass: { status: "checked_in", patientName: "Ada Obi" } });
    const second = await checkInScannedPass(g, { clinicId: CLINIC, qrText: QR }, NOW);
    expect(second).toMatchObject({ outcome: "rejected", reason: "already_checked_in" });
    expect(state.checkIns).toBe(1);
  });

  it("never returns the secret token to the browser", async () => {
    const { g } = gateway();
    const result = await verifyScannedPass(g, { clinicId: CLINIC, qrText: QR }, NOW);
    expect(result.outcome).toBe("verified");
    expect(JSON.stringify(result)).not.toContain(TOKEN);
  });
});
