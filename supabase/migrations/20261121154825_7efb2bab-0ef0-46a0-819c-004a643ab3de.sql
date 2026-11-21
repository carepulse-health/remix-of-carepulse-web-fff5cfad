ALTER TABLE public.appointments
  DROP CONSTRAINT appointments_status_check,
  ADD CONSTRAINT appointments_status_check
  CHECK (status = ANY (ARRAY['pending','confirmed','checked_in','completed','cancelled','rescheduled']::text[]));