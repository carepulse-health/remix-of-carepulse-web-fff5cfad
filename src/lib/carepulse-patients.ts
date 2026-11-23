import { z } from "zod";

/** Clinic roles the database allows to register and edit patient records. */
export const PATIENT_MANAGER_ROLES = ["admin", "receptionist"];

export function canManagePatients(roles: string[]) {
  return roles.some((role) => PATIENT_MANAGER_ROLES.includes(role.trim().toLowerCase()));
}

const optionalText = (max: number) =>
  z.string().trim().max(max).transform((value) => (value === "" ? null : value));

const optionalPhone = z
  .string()
  .trim()
  .max(30)
  .refine((value) => value === "" || /^[+0-9 ()-]{7,30}$/.test(value), "Enter a valid phone number.")
  .transform((value) => (value === "" ? null : value));

export const patientFormSchema = z.object({
  full_name: z.string().trim().min(2, "Enter the patient's full name.").max(120),
  date_of_birth: z
    .string()
    .trim()
    .refine((value) => value === "" || (/^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(value) <= new Date()), "Enter a valid date of birth that is not in the future.")
    .transform((value) => (value === "" ? null : value)),
  gender: optionalText(30),
  phone: optionalPhone,
  email: z
    .string()
    .trim()
    .max(255)
    .refine((value) => value === "" || z.string().email().safeParse(value).success, "Enter a valid email address.")
    .transform((value) => (value === "" ? null : value.toLowerCase())),
  address: optionalText(500),
  emergency_contact_name: optionalText(120),
  emergency_contact_phone: optionalPhone,
});

export type PatientFormValues = z.output<typeof patientFormSchema>;

export function parsePatientForm(form: Record<string, unknown>) {
  const raw = Object.fromEntries(Object.keys(patientFormSchema.shape).map((key) => [key, String(form[key] ?? "")]));
  return patientFormSchema.safeParse(raw);
}
