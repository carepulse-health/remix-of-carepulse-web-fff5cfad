import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { PASS_SERVICE_ERROR, type PassGateway } from "./carepulse-pass";

function fail(step: string, error: { code?: string } | null): never {
  // Log only the failing step and error code; never the scanned token.
  console.error(`[carepulse-pass] ${step} failed`, error?.code ?? "unknown");
  throw new Error(PASS_SERVICE_ERROR);
}

/** Uses the signed-in staff member's client, so every read and write stays under the database's RLS rules. */
export function createPassGateway(client: SupabaseClient<Database>, userId: string): PassGateway {
  return {
    async rolesForClinic(clinicId) {
      const { data, error } = await client.from("clinic_members").select("role").eq("clinic_id", clinicId).eq("user_id", userId);
      if (error) fail("membership lookup", error);
      return (data ?? []).map((row) => row.role);
    },
    async verifyToken(referenceCode, token) {
      const { data, error } = await client.rpc("verify_appointment_pass", { _reference_code: referenceCode, _token: token });
      if (error) fail("pass verification", error);
      return data === true;
    },
    async findPass(referenceCode, token) {
      const { data, error } = await client
        .from("appointment_passes")
        .select("clinic_id, appointment_id, patient_id, reference_code, expires_at")
        .eq("reference_code", referenceCode)
        .eq("qr_code", token)
        .maybeSingle();
      if (error) fail("pass lookup", error);
      return data ? { clinicId: data.clinic_id, appointmentId: data.appointment_id, patientId: data.patient_id, referenceCode: data.reference_code, expiresAt: data.expires_at } : null;
    },
    async findAppointment(appointmentId, clinicId) {
      const { data, error } = await client
        .from("appointments")
        .select("id, patient_id, doctor_id, appointment_date, appointment_time, reason, status")
        .eq("id", appointmentId)
        .eq("clinic_id", clinicId)
        .maybeSingle();
      if (error) fail("appointment lookup", error);
      return data ? { id: data.id, patientId: data.patient_id, doctorId: data.doctor_id, date: data.appointment_date, time: data.appointment_time, reason: data.reason, status: data.status } : null;
    },
    async describe({ clinicId, patientId, doctorId }) {
      const [patient, clinic, doctor] = await Promise.all([
        client.from("patients").select("full_name").eq("id", patientId).eq("clinic_id", clinicId).maybeSingle(),
        client.from("clinics").select("name").eq("id", clinicId).maybeSingle(),
        doctorId ? client.from("doctors").select("full_name").eq("id", doctorId).eq("clinic_id", clinicId).maybeSingle() : Promise.resolve({ data: null, error: null }),
      ]);
      if (patient.error) fail("patient lookup", patient.error);
      return {
        patientName: patient.data?.full_name ?? null,
        clinicName: clinic.data?.name ?? null,
        doctorName: doctor.error ? null : doctor.data?.full_name ?? null,
      };
    },
    async checkIn(appointmentId, clinicId) {
      const { data, error } = await client
        .from("appointments")
        .update({ status: "checked_in", updated_at: new Date().toISOString() })
        .eq("id", appointmentId)
        .eq("clinic_id", clinicId)
        .eq("status", "confirmed")
        .select("id");
      if (error) fail("check-in", error);
      return (data ?? []).length > 0;
    },
  };
}
