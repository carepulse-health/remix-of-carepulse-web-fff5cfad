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
import type {
  DoctorRecord,
  ScheduleRecord,
} from "@/lib/carepulse-staff-data";

const scheduleSchema = z.object({
  day_of_week: z.string().min(1, "Choose a day."),
  start_time: z.string().min(1, "Enter a start time."),
  end_time: z.string().min(1, "Enter an end time."),
  is_available: z.boolean(),
});

export type ScheduleFormValues = z.infer<typeof scheduleSchema>;

type ScheduleDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
  error: string;
  doctor: DoctorRecord | null;
  schedule: ScheduleRecord | null;
  onSave: (values: ScheduleFormValues) => void;
};

export function ScheduleDialog({
  open,
  onOpenChange,
  busy,
  error,
  doctor,
  schedule,
  onSave,
}: ScheduleDialogProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);

    const result = scheduleSchema.safeParse({
      day_of_week: form.get("day_of_week"),
      start_time: form.get("start_time"),
      end_time: form.get("end_time"),
      is_available: form.get("is_available") === "true",
    });

    if (!result.success) return;

    onSave(result.data);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>
            {schedule ? "Edit schedule" : "Add doctor schedule"}
          </DialogTitle>
          <DialogDescription>
            {doctor?.full_name} — set the doctor's working day and hours.
          </DialogDescription>
        </DialogHeader>

        <form
          key={schedule?.id ?? "new"}
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          <div className="space-y-1">
            <label className="text-sm font-medium">Day of the week</label>
            <select
              name="day_of_week"
              defaultValue={schedule?.day_of_week ?? "Monday"}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              {[
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday",
                "Sunday",
              ].map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Start time</label>
            <Input
              name="start_time"
              type="time"
              defaultValue={schedule?.start_time ?? "09:00"}
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">End time</label>
            <Input
              name="end_time"
              type="time"
              defaultValue={schedule?.end_time ?? "17:00"}
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Availability</label>
            <select
              name="is_available"
              defaultValue={String(schedule?.is_available ?? true)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="true">Available</option>
              <option value="false">Unavailable</option>
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

            <Button type="submit" disabled={busy || !doctor}>
              {busy ? "Saving..." : schedule ? "Save changes" : "Add schedule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
