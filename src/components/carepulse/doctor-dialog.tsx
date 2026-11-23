import type { FormEvent } from "react";
import { z } from "zod";
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
import type { DoctorRecord } from "@/lib/carepulse-staff-data";

const doctorSchema = z.object({
  full_name: z.string().trim().min(2, "Enter the doctor's full name.").max(120),
  specialization: z.string().trim().max(120).transform((value) => value || null),
  availability_status: z.string().trim().min(1),
});

export type DoctorFormValues = z.output<typeof doctorSchema>;

type DoctorDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
  error: string;
  doctor: DoctorRecord | null;
  onSave: (values: DoctorFormValues) => void;
};

export function DoctorDialog({
  open,
  onOpenChange,
  busy,
  error,
  doctor,
  onSave,
}: DoctorDialogProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    const result = doctorSchema.safeParse({
      full_name: formData.get("full_name"),
      specialization: formData.get("specialization"),
      availability_status: formData.get("availability_status"),
    });

    if (!result.success) {
      return;
    }

    onSave(result.data);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>
            {doctor ? "Edit doctor" : "Add doctor"}
          </DialogTitle>
          <DialogDescription>
            Doctor profile for this clinic.
          </DialogDescription>
        </DialogHeader>

        <form
          key={doctor?.id ?? "new"}
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          <div className="space-y-1">
            <label className="text-sm font-medium">Full name</label>
            <Input
              name="full_name"
              defaultValue={doctor?.full_name ?? ""}
              maxLength={120}
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Specialty</label>
            <Input
              name="specialization"
              defaultValue={doctor?.specialization ?? ""}
              maxLength={120}
              placeholder="e.g. General practice"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Availability</label>
            <select
              name="availability_status"
              defaultValue={doctor?.availability_status ?? "available"}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="available">Available</option>
              <option value="busy">Busy</option>
              <option value="on_leave">On leave</option>
              <option value="unavailable">Unavailable</option>
              {doctor?.availability_status &&
                !["available", "busy", "on_leave", "unavailable"].includes(
                  doctor.availability_status
                ) && (
                  <option value={doctor.availability_status}>
                    {doctor.availability_status}
                  </option>
                )}
            </select>
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
              {busy ? "Saving..." : doctor ? "Save changes" : "Add doctor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
