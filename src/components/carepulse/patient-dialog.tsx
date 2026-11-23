import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { PatientRecord } from "@/lib/carepulse-staff-data";
import {
  parsePatientForm,
  type PatientFormValues,
} from "@/lib/carepulse-patients";

type PatientDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
  error: string;
  patient: PatientRecord | null;
  onSave: (values: PatientFormValues) => void;
};

export function PatientDialog({
  open,
  onOpenChange,
  busy,
  error,
  patient,
  onSave,
}: PatientDialogProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const values = Object.fromEntries(formData.entries());
    const result = parsePatientForm(values);

    if (!result.success) {
      return;
    }

    onSave(result.data);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>
            {patient ? "Edit patient" : "Register patient"}
          </DialogTitle>
          <DialogDescription>
            {patient
              ? "Update this patient's registration details."
              : "Register a new patient with this clinic."}
          </DialogDescription>
        </DialogHeader>

        <form
          key={patient?.id ?? "new"}
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          <div className="space-y-1">
            <label className="text-sm font-medium">Full name</label>
            <Input
              name="full_name"
              defaultValue={patient?.full_name ?? ""}
              required
              maxLength={120}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Date of birth</label>
              <Input
                type="date"
                name="date_of_birth"
                defaultValue={patient?.date_of_birth ?? ""}
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Gender</label>
              <select
                name="gender"
                defaultValue={patient?.gender ?? ""}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">Not specified</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Phone</label>
              <Input
                name="phone"
                type="tel"
                defaultValue={patient?.phone ?? ""}
                maxLength={30}
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Email</label>
              <Input
                name="email"
                type="email"
                defaultValue={patient?.email ?? ""}
                maxLength={255}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Address</label>
            <Input
              name="address"
              defaultValue={patient?.address ?? ""}
              maxLength={500}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">
                Emergency contact name
              </label>
              <Input
                name="emergency_contact_name"
                defaultValue={patient?.emergency_contact_name ?? ""}
                maxLength={120}
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">
                Emergency contact phone
              </label>
              <Input
                name="emergency_contact_phone"
                type="tel"
                defaultValue={patient?.emergency_contact_phone ?? ""}
                maxLength={30}
              />
            </div>
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>

            <Button type="submit" disabled={busy}>
              {busy
                ? "Saving..."
                : patient
                  ? "Save changes"
                  : "Register patient"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
