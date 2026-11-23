import { useMemo, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import {
  Activity, AlertCircle, ArrowRight, Bell, CalendarDays, Check, CheckCircle2,
  ChevronDown, Clock3, ClipboardList, HeartPulse, LayoutDashboard, LogOut,
  Menu, Plus, ScanLine, Search, Settings2, ShieldCheck, Stethoscope, Users, UserRound,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  addClinicConsultation,
  changeClinicAppointmentStatus,
  clinicWorkspaceQueryOptions,
  createClinicAppointment,
 createClinicPatient,
updateClinicPatient,
  createClinicDoctor,
  updateClinicDoctor,
  createClinicSchedule,
  updateClinicSchedule,
  markClinicNotificationRead,
  reviewClinicTriage,
  type AppointmentRecord,
  type ClinicWorkspace,
  type ConsultationRecord,
  type DoctorRecord,
  type NotificationRecord,
  type PatientRecord,
  type TriageRecord,
} from "@/lib/carepulse-staff-data";

import { PatientDialog } from "@/components/carepulse/patient-dialog";
import { DoctorDialog, type DoctorFormValues } from "@/components/carepulse/doctor-dialog";
import { canManagePatients } from "@/lib/carepulse-patients";
import type { PatientFormValues } from "@/lib/carepulse-patients";
import { supabase } from "@/integrations/supabase/client";
import { PassScannerDialog } from "@/components/carepulse/pass-scanner-dialog";
import { canScanPasses } from "@/lib/carepulse-pass";
import {
  initialAppointments, initialDoctors, initialPatients, initialTriage,
} from "@/lib/carepulse-data";
  markClinicNotificationRead,
  reviewClinicTriage,
  type AppointmentRecord,
  type ClinicWorkspace,
  type ConsultationRecord,
  type DoctorRecord,
  type NotificationRecord,
  type PatientRecord,
  type TriageRecord,
} from "@/lib/carepulse-staff-data";

import { PatientDialog } from "@/components/carepulse/patient-dialog";
import { DoctorDialog, type DoctorFormValues } from "@/components/carepulse/doctor-dialog";
import { canManagePatients } from "@/lib/carepulse-patients";
import type { PatientFormValues } from "@/lib/carepulse-patients";
import { supabase } from "@/integrations/supabase/client";
import { PassScannerDialog } from "@/components/carepulse/pass-scanner-dialog";
import { canScanPasses } from "@/lib/carepulse-pass";
import {
  initialAppointments, initialDoctors, initialPatients, initialTriage,
} from "@/lib/carepulse-data";

type Section = "Overview" | "Appointments" | "Patients" | "Triage Queue" | "Doctors" | "Consultations" | "Notifications" | "Settings";
type DemoAppointment = (typeof initialAppointments)[number];
type DemoPatient = (typeof initialPatients)[number];
type DemoDoctor = (typeof initialDoctors)[number];
type DemoTriage = (typeof initialTriage)[number];

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Clinic staff dashboard | CarePulse" },
      { name: "description", content: "A secure CarePulse workspace for clinic appointments, patient records, screenings and consultations." },
      { property: "og:title", content: "Clinic staff dashboard | CarePulse" },
      { property: "og:description", content: "A secure CarePulse workspace for clinic staff." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(clinicWorkspaceQueryOptions(context.user.id)),
  errorComponent: ({ error }) => <RouteError message={error instanceof Error ? error.message : "The clinic workspace could not be opened."} />,
  notFoundComponent: () => <RouteError message="This clinic workspace is unavailable." />,
  pendingComponent: () => <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading clinic workspace…</div>,
  component: CarePulseDashboard,
});

const navItems: { label: Section; icon: typeof LayoutDashboard }[] = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Appointments", icon: CalendarDays },
  { label: "Patients", icon: Users },
  { label: "Triage Queue", icon: Activity },
  { label: "Doctors", icon: Stethoscope },
  { label: "Consultations", icon: ClipboardList },
  { label: "Notifications", icon: Bell },
  { label: "Settings", icon: Settings2 },
];

function CarePulseDashboard() {
  const routeContext = Route.useRouteContext();
  const user = routeContext.user;
  const { data: workspace } = useSuspenseQuery(clinicWorkspaceQueryOptions(user.id));
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [section, setSection] = useState<Section>("Overview");
  const [selectedClinicId, setSelectedClinicId] = useState(workspace.clinics[0]?.id ?? "");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [appointmentModal, setAppointmentModal] = useState(false);
const [consultationModal, setConsultationModal] = useState(false);
const [selectedAppointment, setSelectedAppointment] = useState<AppointmentRecord | null>(null);
const [patientModal, setPatientModal] = useState(false);
const [selectedPatient, setSelectedPatient] = useState<PatientRecord | null>(null);

const [doctorModal, setDoctorModal] = useState(false);
const [selectedDoctor, setSelectedDoctor] = useState<DoctorRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const demoMode = workspace.memberships.length === 0;
  const clinic = workspace.clinics.find((item) => item.id === selectedClinicId) ?? workspace.clinics[0] ?? null;
  const clinicId = clinic?.id ?? "";
  const canScan = !demoMode && canScanPasses(workspace.memberships.filter((item) => item.clinic_id === clinicId).map((item) => item.role));
const canManagePatientRecords = !demoMode && canManagePatients(
  workspace.memberships
    .filter((item) => item.clinic_id === clinicId)
    .map((item) => item.role)
);

const canManageDoctorRecords = !demoMode && canManagePatients(
  workspace.memberships
    .filter((item) => item.clinic_id === clinicId)
    .map((item) => item.role)
);
  const patients = demoMode ? [] : workspace.patients.filter((item) => item.clinic_id === clinicId);
  const appointments = demoMode ? [] : workspace.appointments.filter((item) => item.clinic_id === clinicId);
  const doctors = demoMode ? [] : workspace.doctors.filter((item) => item.clinic_id === clinicId);
  const schedules = demoMode ? [] : workspace.schedules.filter((item) => item.clinic_id === clinicId);
  const triage = demoMode ? [] : workspace.triage.filter((item) => item.clinic_id === clinicId);
  const consultations = demoMode ? [] : workspace.consultations.filter((item) => item.clinic_id === clinicId);
  const notifications = demoMode ? [] : workspace.notifications.filter((item) => !item.clinic_id || item.clinic_id === clinicId);
  const settings = demoMode ? null : workspace.settings.find((item) => item.clinic_id === clinicId) ?? null;
  const searchable = query.trim().toLocaleLowerCase();
  const filteredPatients = patients.filter((patient) => !searchable || [patient.full_name, patient.phone ?? "", patient.email ?? ""].some((text) => text.toLocaleLowerCase().includes(searchable)));
  const filteredAppointments = appointments.filter((appointment) => {
    if (!searchable) return true;
    const patientName = patients.find((patient) => patient.id === appointment.patient_id)?.full_name ?? "";
    return `${patientName} ${appointment.reason ?? ""} ${appointment.status ?? ""}`.toLocaleLowerCase().includes(searchable);
  });
  const unreadCount = notifications.filter((item) => !item.is_read).length;
  const pageDescriptions: Record<Section, string> = {
    Overview: "A current view of clinic activity and patient care.",
    Appointments: "Schedule and track clinic visits.",
    Patients: "Review patient records available to your clinic team.",
    "Triage Queue": "Review submitted patient screenings.",
    Doctors: "View doctors and their current schedules.",
    Consultations: "Review and record clinical consultations.",
    Notifications: "Important clinic alerts and reminders.",
    Settings: "Clinic information and access status.",
  };

  async function reloadWorkspace() {
    await queryClient.invalidateQueries({ queryKey: ["carepulse", "staff-workspace", user.id] });
  }

  async function handleSignOut() {
    setErrorMessage("");
    await queryClient.cancelQueries();
    queryClient.clear();
    const { error } = await supabase.auth.signOut();
    if (error) {
      setErrorMessage("You could not be signed out. Please try again.");
      return;
    }
    await navigate({ to: "/", replace: true });
  }

  async function saveAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const selectedPatient = String(form.get("patient") ?? "");
    const selectedDoctor = String(form.get("doctor") ?? "");
    if (!clinicId || !patients.some((item) => item.id === selectedPatient) || !doctors.some((item) => item.id === selectedDoctor)) {
      setErrorMessage("Choose a patient and doctor from this clinic.");
      return;
    }
    setBusy(true);
    setErrorMessage("");
    try {
      await createClinicAppointment({
        clinicId,
        patientId: selectedPatient,
        doctorId: selectedDoctor,
        date: String(form.get("date") ?? ""),
        time: String(form.get("time") ?? ""),
        reason: String(form.get("reason") ?? "").trim(),
      });
      setAppointmentModal(false);
      setNotice("Appointment saved.");
      await reloadWorkspace();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "The appointment could not be saved.");
    } finally {
      setBusy(false);
    }
  }
async function savePatient(values: PatientFormValues) {
  if (!clinicId || !canManagePatientRecords) {
    setErrorMessage("Only clinic admins and reception staff can manage patient records.");
    return;
  }

  setBusy(true);
  setErrorMessage("");

  try {
    if (selectedPatient) {
      await updateClinicPatient({
        clinicId,
        patientId: selectedPatient.id,
        values,
      });
      setNotice("Patient details updated.");
    } else {
      await createClinicPatient({ clinicId, values });
      setNotice("Patient registered.");
    }

    setPatientModal(false);
    setSelectedPatient(null);
    await reloadWorkspace();
  } catch (error) {
    setErrorMessage(
      error instanceof Error
        ? error.message
        : "The patient record could not be saved."
    );
  } finally {
    setBusy(false);
  }
}

async function saveDoctor(values: DoctorFormValues) {
  if (!clinicId || !canManageDoctorRecords) {
    setErrorMessage("You do not have permission to manage doctor records.");
    return;
  }

  setBusy(true);
  setErrorMessage("");

  try {
    if (selectedDoctor) {
      await updateClinicDoctor({
        clinicId,
        doctorId: selectedDoctor.id,
        values,
      });
      setNotice("Doctor details updated.");
    } else {
      await createClinicDoctor({ clinicId, values });
      setNotice("Doctor added.");
    }

    setDoctorModal(false);
    setSelectedDoctor(null);
    await reloadWorkspace();
  } catch (error) {
    setErrorMessage(
      error instanceof Error
        ? error.message
        : "The doctor record could not be saved."
    );
  } finally {
    setBusy(false);
  }
}
  async function updateAppointment(appointmentId: string, status: string) {
    setBusy(true);
    setErrorMessage("");
    try {
      await changeClinicAppointmentStatus({ clinicId, appointmentId, status });
      setNotice("Appointment updated.");
      await reloadWorkspace();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "The appointment could not be updated.");
    } finally {
      setBusy(false);
    }
  }

  async function reviewTriage(item: TriageRecord) {
    setBusy(true);
    setErrorMessage("");
    try {
      await reviewClinicTriage({ clinicId, triageId: item.id, userId: user.id });
      setNotice("Screening marked as reviewed.");
      await reloadWorkspace();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "The screening could not be updated.");
    } finally {
      setBusy(false);
    }
  }

  async function saveConsultation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const patientId = String(form.get("patient") ?? "");
    const patient = patients.find((item) => item.id === patientId);
    if (!patient || !clinicId) {
      setErrorMessage("Choose a patient from this clinic.");
      return;
    }
    const requestedDoctor = String(form.get("doctor") ?? "");
    const requestedAppointment = String(form.get("appointment") ?? "");
    setBusy(true);
    setErrorMessage("");
    try {
      await addClinicConsultation({
        clinicId,
        patientId,
        doctorId: doctors.some((item) => item.id === requestedDoctor) ? requestedDoctor : null,
        appointmentId: appointments.some((item) => item.id === requestedAppointment) ? requestedAppointment : null,
        notes: String(form.get("notes") ?? "").trim(),
        followUpDate: String(form.get("followUpDate") ?? "") || null,
      });
      setConsultationModal(false);
      setSelectedAppointment(null);
      setNotice("Consultation recorded.");
      await reloadWorkspace();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "The consultation could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function markNotificationRead(item: NotificationRecord) {
    if (!clinicId) return;
    setBusy(true);
    setErrorMessage("");
    try {
      await markClinicNotificationRead({ clinicId, notificationId: item.id, userId: user.id });
      await reloadWorkspace();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "The alert could not be updated.");
    } finally {
      setBusy(false);
    }
  }

  const shownClinicNames = useMemo(() => workspace.clinics.map((item) => ({ id: item.id, name: item.name })), [workspace.clinics]);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {drawerOpen && <Button variant="ghost" className="fixed inset-0 z-40 h-full w-full rounded-none bg-foreground/35 hover:bg-foreground/35 lg:hidden" aria-label="Close menu" onClick={() => setDrawerOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-[250px] flex-col bg-sidebar text-sidebar-foreground transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${drawerOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-[72px] items-center justify-between border-b border-sidebar-border px-5">
          <div className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground"><HeartPulse className="size-5" /></span><span className="font-display text-lg font-extrabold">carepulse<span className="text-sidebar-primary">.</span></span></div>
          <Button variant="ghost" size="icon" className="text-sidebar-foreground lg:hidden" onClick={() => setDrawerOpen(false)} aria-label="Close menu"><X /></Button>
        </div>
        <div className="border-b border-sidebar-border px-4 py-4">
          {shownClinicNames.length > 1 ? (
            <Select value={clinicId} onValueChange={setSelectedClinicId}>
              <SelectTrigger className="border-sidebar-border bg-sidebar-accent text-xs text-sidebar-foreground"><SelectValue placeholder="Choose clinic" /></SelectTrigger>
              <SelectContent>{shownClinicNames.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
            </Select>
          ) : (
            <div className="flex items-center gap-3 rounded-md px-2 py-2"><span className="flex size-8 items-center justify-center rounded-md bg-sidebar-primary/15 text-sidebar-primary"><HeartPulse className="size-4" /></span><span className="min-w-0"><span className="block truncate text-xs font-semibold">{clinic?.name ?? "Clinic workspace"}</span><span className="mt-0.5 block truncate text-[10px] text-sidebar-foreground/60">{demoMode ? "Sample workspace" : "Authorized clinic"}</span></span></div>
          )}
        </div>
        <nav aria-label="Clinic sections" className="flex-1 overflow-y-auto px-3 py-5">
          <p className="mb-2 px-3 text-[9px] font-bold tracking-[0.15em] text-sidebar-foreground/45">CLINIC WORKSPACE</p>
          <div className="space-y-1">{navItems.map(({ label, icon: Icon }) => <Button key={label} variant="ghost" onClick={() => { setSection(label); setDrawerOpen(false); setNotice(""); setErrorMessage(""); }} className={`h-10 w-full justify-start gap-3 rounded-md px-3 text-xs ${section === label ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground"}`}><Icon className={`size-4 ${section === label ? "text-sidebar-primary" : "text-sidebar-foreground/60"}`} />{label}{label === "Notifications" && unreadCount > 0 && <span className="ml-auto rounded-full bg-destructive px-1.5 py-0.5 text-[9px] font-bold text-destructive-foreground">{unreadCount}</span>}</Button>)}</div>
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="rounded-md bg-sidebar-accent/70 px-3 py-3"><div className="flex items-center gap-2 text-[11px] font-semibold"><span className="size-2 rounded-full bg-status-positive" />{demoMode ? "Sample workspace" : "Clinic access verified"}</div><p className="mt-1.5 pl-4 text-[10px] text-sidebar-foreground/55">{demoMode ? "No live clinic records shown" : "Records governed by clinic access"}</p></div>
          <Button variant="ghost" onClick={handleSignOut} className="mt-2 h-10 w-full justify-start gap-3 px-3 text-[11px] text-sidebar-foreground/75 hover:bg-sidebar-accent"><LogOut className="size-4" />Sign out</Button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="flex h-[72px] items-center justify-between border-b border-border bg-card px-4 sm:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu" onClick={() => setDrawerOpen(true)}><Menu /></Button>
            <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex"><span>CarePulse</span><ArrowRight className="size-3" /><span className="font-semibold text-foreground">{section}</span></div>
            <span className="truncate text-sm font-semibold sm:hidden">{section}</span>
          </div>
          <div className="flex items-center gap-3 sm:gap-5">
            <div className="hidden h-9 w-64 items-center gap-2 rounded-md border border-input bg-background px-3 md:flex"><Search className="size-4 text-muted-foreground" /><Input aria-label="Search clinic records" value={query} onChange={(event) => setQuery(event.target.value)} className="h-full border-0 px-0 shadow-none focus-visible:ring-0" placeholder="Search this clinic…" /></div>
            <Button variant="ghost" size="icon" className="relative" aria-label="Open notifications" onClick={() => setSection("Notifications")}><Bell className="size-[18px]" />{unreadCount > 0 && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-destructive ring-2 ring-card" />}</Button>
            <span className="hidden max-w-48 truncate border-l border-border pl-4 text-xs text-muted-foreground sm:block">{workspace.email || user.email}</span>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-7 sm:py-8 lg:px-10">
          {demoMode && <div role="status" className="mb-6 flex gap-3 border-l-4 border-l-status-warning bg-status-warning/10 px-4 py-3 text-sm"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-status-warning" /><div><p className="font-semibold">Sample workspace · no live patient data</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Your account has no clinic membership yet. Demo records are shown separately and cannot be changed or saved.</p></div></div>}
          {!demoMode && workspace.clinics.length === 0 && <div role="alert" className="mb-6 border-l-4 border-l-destructive bg-destructive/10 px-4 py-3 text-sm"><p className="font-semibold">Clinic access needs attention</p><p className="mt-1 text-xs text-muted-foreground">Your account is listed as a clinic member, but no clinic records are available under the current access rules. Ask your clinic administrator to review your membership.</p></div>}
          {errorMessage && <div role="alert" className="mb-4 border-l-4 border-l-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive">{errorMessage}</div>}
          {notice && <div role="status" className="mb-4 border-l-4 border-l-status-positive bg-status-positive/10 px-4 py-3 text-sm text-status-positive">{notice}</div>}
          <div className="mb-7 flex flex-col justify-between gap-4 sm:mb-8 sm:flex-row sm:items-end">
            <div><p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-care-blue">{formatToday()}</p><h1 className="font-display text-[26px] font-bold leading-tight sm:text-[30px]">{section === "Overview" ? "Clinic overview" : section}</h1><p className="mt-1.5 text-sm text-muted-foreground">{pageDescriptions[section]}</p></div>
            {!demoMode && clinic && <div className="flex flex-wrap gap-2 sm:justify-end"><Button className="h-10 gap-2" disabled={!canScan} onClick={() => { setErrorMessage(""); setNotice(""); setScannerOpen(true); }}><ScanLine className="size-4" />Scan Patient QR</Button><Button variant="outline" className="h-10 gap-2" onClick={() => { setErrorMessage(""); setAppointmentModal(true); }}><CalendarDays className="size-4" />Schedule appointment</Button>{section === "Consultations" && <Button className="h-10 gap-2" onClick={() => { setSelectedAppointment(null); setConsultationModal(true); }}><Plus className="size-4" />Record consultation</Button>}{!canScan && <p className="w-full text-[11px] text-muted-foreground sm:text-right">QR check-in is limited to clinic admins and reception staff.</p>}</div>}
          </div>

          {demoMode ? <DemoContent section={section} query={query} onSection={setSection} /> : clinic ? <LiveContent
            section={section}
            patients={filteredPatients}
            allPatients={patients}
            appointments={filteredAppointments}
            allAppointments={appointments}
            doctors={doctors}
            schedules={schedules}
            triage={triage}
            consultations={consultations}
            notifications={notifications}
            clinic={clinic}
            settings={settings}
            unavailable={workspace.unavailable}
            userId={user.id}
            busy={busy}
   canManagePatients={canManagePatientRecords}
 canManageDoctors={canManageDoctorRecords}
onAddDoctor={() => { setSelectedDoctor(null); setErrorMessage(""); setDoctorModal(true); }}
onEditDoctor={(doctor) => { setSelectedDoctor(doctor); setErrorMessage(""); setDoctorModal(true); }}                                                                                                         
onAddPatient={() => { setSelectedPatient(null); setErrorMessage(""); setPatientModal(true); }}
onEditPatient={(patient) => { setSelectedPatient(patient); setErrorMessage(""); setPatientModal(true); }}                                                                                    
            onAppointmentStatus={updateAppointment}
            onReviewTriage={reviewTriage}
            onConsultation={() => { setSelectedAppointment(null); setConsultationModal(true); }}
            onMarkRead={markNotificationRead}
            onNewAppointment={() => setAppointmentModal(true)}
          /> : <div className="border border-dashed border-border px-6 py-16 text-center"><ShieldCheck className="mx-auto size-8 text-muted-foreground" /><h2 className="mt-4 text-base font-semibold">No clinic workspace available</h2><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Ask your clinic administrator to verify your clinic membership and access.</p></div>}
        </main>
      </div>

      {!demoMode && clinic && <PassScannerDialog open={scannerOpen} onOpenChange={setScannerOpen} clinicId={clinic.id} clinicName={clinic.name} onCheckedIn={(pass) => { setNotice(`${pass.patientName} was checked in from their QR pass.`); void reloadWorkspace(); }} />}
      <AppointmentDialog open={appointmentModal} onOpenChange={setAppointmentModal} patients={patients} doctors={doctors} busy={busy} onSubmit={saveAppointment} />
      <ConsultationDialog open={consultationModal} onOpenChange={setConsultationModal} patients={patients} doctors={doctors} appointments={appointments} selectedAppointment={selectedAppointment} busy={busy} onSubmit={saveConsultation} />
  <PatientDialog
  open={patientModal}
  onOpenChange={(open) => {
    setPatientModal(open);
    if (!open) setSelectedPatient(null);
  }}
  busy={busy}
  error={errorMessage}
  patient={selectedPatient}
  onSave={savePatient}
/>
      <DoctorDialog
  open={doctorModal}
  onOpenChange={(open) => {
    setDoctorModal(open);
    if (!open) setSelectedDoctor(null);
  }}
  busy={busy}
  error={errorMessage}
  doctor={selectedDoctor}
  onSave={saveDoctor}
/>
    </div>
  );
}

function LiveContent(props: {
  section: Section;
  patients: PatientRecord[];
  allPatients: PatientRecord[];
  appointments: AppointmentRecord[];
  allAppointments: AppointmentRecord[];
  doctors: DoctorRecord[];
  schedules: ClinicWorkspace["schedules"];
  triage: TriageRecord[];
  consultations: ConsultationRecord[];
  notifications: NotificationRecord[];
  clinic: NonNullable<ClinicWorkspace["clinics"][number]>;
  settings: ClinicWorkspace["settings"][number] | null;
  unavailable: string[];
  userId: string;
  busy: boolean;

  canManagePatients: boolean;
  onAddPatient: () => void;
  onEditPatient: (patient: PatientRecord) => void;

  canManageDoctors: boolean;
  onAddDoctor: () => void;
  onEditDoctor: (doctor: DoctorRecord) => void;
  onAppointmentStatus: (id: string, status: string) => void;
  onReviewTriage: (item: TriageRecord) => void;
  onConsultation: () => void;
  onMarkRead: (item: NotificationRecord) => void;
  onNewAppointment: () => void;
}) {
  if (props.section === "Overview") return <OverviewContent {...props} />;
  if (props.section === "Appointments") return <AppointmentsContent {...props} />;
 if (props.section === "Patients") return (
  <PatientsContent
    patients={props.patients}
    canManage={props.canManagePatients}
    onAdd={props.onAddPatient}
    onEdit={props.onEditPatient}
  />
);
  if (props.section === "Triage Queue") return <TriageContent triage={props.triage} patients={props.allPatients} busy={props.busy} onReview={props.onReviewTriage} />;
 if (props.section === "Doctors") return (
  <DoctorsContent
    doctors={props.doctors}
    schedules={props.schedules}
    unavailable={props.unavailable}
    canManage={props.canManageDoctors}
    onAdd={props.onAddDoctor}
    onEdit={props.onEditDoctor}
  />
);
  if (props.section === "Consultations") return <ConsultationsContent consultations={props.consultations} appointments={props.allAppointments} patients={props.allPatients} doctors={props.doctors} onCreate={props.onConsultation} />;
  if (props.section === "Notifications") return <NotificationsContent notifications={props.notifications} busy={props.busy} onRead={props.onMarkRead} />;
  return <SettingsContent clinic={props.clinic} settings={props.settings} />;
}

function OverviewContent(props: Parameters<typeof LiveContent>[0]) {
  const pendingScreenings = props.triage.filter((item) => item.review_status !== "reviewed").length;
  const cards = [
    { title: "Total patients", value: props.allPatients.length, icon: Users, tint: "text-primary bg-primary/10" },
    { title: "Appointments", value: props.allAppointments.length, icon: CalendarDays, tint: "text-care-teal bg-care-teal/12" },
    { title: "Pending screenings", value: pendingScreenings, icon: Activity, tint: "text-status-warning bg-status-warning/15" },
    { title: "Consultations", value: props.consultations.length, icon: ClipboardList, tint: "text-status-positive bg-status-positive/12" },
  ];
  return <>
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map(({ title, value, icon: Icon, tint }) => <article key={title} className="border border-border bg-card p-5"><div className="flex items-start justify-between"><div><p className="text-xs font-medium text-muted-foreground">{title}</p><p className="mt-3 text-3xl font-bold">{value.toLocaleString()}</p></div><span className={`flex size-10 items-center justify-center rounded-md ${tint}`}><Icon className="size-5" /></span></div><p className="mt-3 text-[11px] text-muted-foreground">Current clinic records</p></article>)}</section>
    <section className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-3">
      <article className="border border-border bg-card xl:col-span-2"><div className="flex items-center justify-between border-b border-border px-5 py-4"><div><h2 className="text-sm font-bold">Upcoming appointments</h2><p className="mt-1 text-xs text-muted-foreground">Scheduled visits for this clinic</p></div><Button variant="ghost" size="sm" onClick={() => props.onNewAppointment()}>Schedule <ArrowRight className="ml-1 size-3.5" /></Button></div><AppointmentTable appointments={props.allAppointments.slice(0, 6)} patients={props.allPatients} doctors={props.doctors} busy={props.busy} onStatus={props.onAppointmentStatus} /></article>
      <article className="border border-border bg-card"><div className="border-b border-border px-5 py-4"><h2 className="text-sm font-bold">Screenings needing review</h2><p className="mt-1 text-xs text-muted-foreground">Submitted patient assessments</p></div><div className="space-y-2 p-4">{props.triage.filter((item) => item.review_status !== "reviewed").slice(0, 4).map((item) => <TriageItem key={item.id} item={item} patients={props.allPatients} busy={props.busy} onReview={() => props.onReviewTriage(item)} />)}{props.triage.every((item) => item.review_status === "reviewed") && <EmptyMessage>There are no pending screenings.</EmptyMessage>}</div></article>
    </section>
    <section className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2"><article className="border border-border bg-card"><div className="border-b border-border px-5 py-4"><h2 className="text-sm font-bold">Recent consultations</h2><p className="mt-1 text-xs text-muted-foreground">Latest clinical visit records</p></div><ConsultationList consultations={props.consultations.slice(0, 5)} patients={props.allPatients} doctors={props.doctors} appointments={props.allAppointments} /></article><article className="border border-border bg-card"><div className="border-b border-border px-5 py-4"><h2 className="text-sm font-bold">Clinic team</h2><p className="mt-1 text-xs text-muted-foreground">Doctors and availability</p></div><div className="space-y-3 p-5">{props.doctors.slice(0, 5).map((doctor) => <DoctorRow key={doctor.id} doctor={doctor} />)}{props.doctors.length === 0 && <EmptyMessage>No doctor profiles are available.</EmptyMessage>}</div></article></section>
  </>;
}

function AppointmentsContent(props: Parameters<typeof LiveContent>[0]) {
  return <article className="overflow-hidden border border-border bg-card"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4"><div><h2 className="text-sm font-bold">Appointments</h2><p className="mt-1 text-xs text-muted-foreground">{props.allAppointments.length} appointments in this clinic</p></div><Button onClick={props.onNewAppointment} className="gap-2"><Plus className="size-4" />Schedule appointment</Button></div><AppointmentTable appointments={props.appointments} patients={props.allPatients} doctors={props.doctors} busy={props.busy} onStatus={props.onAppointmentStatus} /></article>;
}

function AppointmentTable({ appointments, patients, doctors, busy, onStatus }: { appointments: AppointmentRecord[]; patients: PatientRecord[]; doctors: DoctorRecord[]; busy: boolean; onStatus: (id: string, status: string) => void }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead className="bg-muted/50"><tr className="text-[10px] font-semibold uppercase text-muted-foreground"><th className="px-5 py-3">Patient</th><th className="px-3 py-3">Date & time</th><th className="px-3 py-3">Doctor</th><th className="px-3 py-3">Reason</th><th className="px-3 py-3">Status</th><th className="px-5 py-3 text-right">Action</th></tr></thead><tbody>{appointments.map((item) => { const status = normalizeStatus(item.status); return <tr key={item.id} className="border-t border-border text-xs"><td className="px-5 py-3 font-medium">{patientName(patients, item.patient_id)}</td><td className="px-3 py-3"><span className="block">{formatDate(item.appointment_date)}</span><span className="mt-1 block text-[10px] text-muted-foreground">{formatTime(item.appointment_time)}</span></td><td className="px-3 py-3 text-muted-foreground">{doctorName(doctors, item.doctor_id)}</td><td className="max-w-48 truncate px-3 py-3 text-muted-foreground">{item.reason || "—"}</td><td className="px-3 py-3"><StatusBadge value={status} /></td><td className="px-5 py-3 text-right">{status === "Pending" ? <Button variant="outline" size="sm" disabled={busy} onClick={() => onStatus(item.id, "confirmed")}>Confirm</Button> : status === "Confirmed" ? <Button variant="outline" size="sm" disabled={busy} onClick={() => onStatus(item.id, "checked_in")}>Check in</Button> : <span className="text-[10px] text-muted-foreground">—</span>}</td></tr>; })}</tbody></table>{appointments.length === 0 && <EmptyMessage>No appointments are available in this clinic.</EmptyMessage>}</div>;
}

function PatientsContent({
  patients,
  canManage,
  onAdd,
  onEdit,
}: {
  patients: PatientRecord[];
  canManage: boolean;
  onAdd: () => void;
  onEdit: (patient: PatientRecord) => void;
}) {
  return (
    <article className="overflow-hidden border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="text-sm font-bold">Patient directory</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Only records visible to your clinic are shown.
          </p>
        </div>

        {canManage && (
          <Button onClick={onAdd} className="gap-2">
            <Plus className="size-4" />
            Add patient
          </Button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left">
          <thead className="bg-muted/50">
            <tr className="text-[10px] font-semibold uppercase text-muted-foreground">
              <th className="px-5 py-3">Patient</th>
              <th className="px-3 py-3">Date of birth</th>
              <th className="px-3 py-3">Gender</th>
              <th className="px-3 py-3">Phone</th>
              <th className="px-3 py-3">Email</th>
              {canManage && <th className="px-5 py-3 text-right">Action</th>}
            </tr>
          </thead>

          <tbody>
            {patients.map((patient) => (
              <tr key={patient.id} className="border-t border-border text-xs">
                <td className="px-5 py-3">
                  <span className="flex items-center gap-2">
                    <PersonAvatar name={patient.full_name} />
                    {patient.full_name}
                  </span>
                </td>
                <td className="px-3 py-3 text-muted-foreground">
                  {patient.date_of_birth ? formatDate(patient.date_of_birth) : "—"}
                </td>
                <td className="px-3 py-3 text-muted-foreground">
                  {patient.gender || "—"}
                </td>
                <td className="px-3 py-3 text-muted-foreground">
                  {patient.phone || "—"}
                </td>
                <td className="px-3 py-3 text-muted-foreground">
                  {patient.email || "—"}
                </td>

                {canManage && (
                  <td className="px-5 py-3 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit(patient)}
                    >
                      Edit
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {patients.length === 0 && (
          <EmptyMessage>No patient records are available in this clinic.</EmptyMessage>
        )}
      </div>
    </article>
  );
}

function TriageContent({ triage, patients, busy, onReview }: { triage: TriageRecord[]; patients: PatientRecord[]; busy: boolean; onReview: (item: TriageRecord) => void }) {
  const pending = triage.filter((item) => item.review_status !== "reviewed");
  return <><section className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3"><MiniMetric label="Awaiting review" value={pending.length} icon={Clock3} /><MiniMetric label="Urgent priority" value={pending.filter((item) => normalizePriority(item.priority_level) === "Emergency").length} icon={AlertCircle} tone="emergency" /><MiniMetric label="Reviewed" value={triage.length - pending.length} icon={CheckCircle2} tone="positive" /></section><article className="border border-border bg-card"><div className="border-b border-border px-5 py-4"><h2 className="text-sm font-bold">Submitted screenings</h2><p className="mt-1 text-xs text-muted-foreground">Review clinical submissions and their recommendations.</p></div><div className="space-y-3 p-4 sm:p-5">{triage.map((item) => <TriageItem key={item.id} item={item} patients={patients} busy={busy} onReview={() => onReview(item)} />)}{triage.length === 0 && <EmptyMessage>No screening records are available in this clinic.</EmptyMessage>}</div><p className="flex items-start gap-2 border-t border-border px-5 py-4 text-xs leading-relaxed text-muted-foreground"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-care-teal" />Screening summaries support care decisions and do not replace professional clinical judgment.</p></article></>;
}

function TriageItem({ item, patients, busy, onReview }: { item: TriageRecord; patients: PatientRecord[]; busy: boolean; onReview: () => void }) {
  const priority = normalizePriority(item.priority_level);
  const reviewed = item.review_status === "reviewed";
  return <div className={`flex flex-col gap-3 border border-border p-4 sm:flex-row sm:items-start ${priority === "Emergency" ? "border-l-4 border-l-priority-emergency" : ""}`}><PersonAvatar name={patientName(patients, item.patient_id)} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold">{patientName(patients, item.patient_id)}</span><PriorityBadge value={priority} /></div><p className="mt-2 text-xs leading-relaxed text-muted-foreground">{item.ai_summary || item.symptoms || "No screening notes provided."}</p>{item.recommended_action && <p className="mt-2 text-xs"><span className="font-semibold">Suggested action:</span> {item.recommended_action}</p>}<p className="mt-2 text-[10px] text-muted-foreground">{item.created_at ? formatDateTime(item.created_at) : "Date not available"}</p></div>{reviewed ? <span className="flex items-center gap-1 text-xs font-medium text-status-positive"><Check className="size-4" />Reviewed</span> : <Button variant="outline" size="sm" disabled={busy} onClick={onReview}>Mark reviewed</Button>}</div>;
}
function DoctorsContent({
  doctors,
  schedules,
  unavailable,
  canManage,
  onAdd,
  onEdit,
}: {
  doctors: DoctorRecord[];
  schedules: ClinicWorkspace["schedules"];
  unavailable: string[];
  canManage: boolean;
  onAdd: () => void;
  onEdit: (doctor: DoctorRecord) => void;
}) {
  const blocked = unavailable.filter(
    (name) => name === "doctors" || name === "doctor schedules"
  );

  return (
    <>
      {blocked.length > 0 && (
        <div role="alert" className="mb-4 border-l-4 border-l-destructive bg-destructive/10 px-4 py-3 text-xs">
          <p className="font-semibold">Doctor information is not available yet</p>
          <p className="mt-1 text-muted-foreground">
            The clinic database does not currently allow staff to view {blocked.join(" or ")}.
            Ask your clinic administrator to enable this access.
          </p>
        </div>
      )}

      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold">Doctor directory</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Manage doctor profiles for your clinic.
          </p>
        </div>

        {canManage && (
          <Button onClick={onAdd} size="sm">
            <Plus className="mr-2 size-4" />
            Add doctor
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {doctors.map((doctor) => (
          <article key={doctor.id} className="border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <PersonAvatar name={doctor.full_name} />
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold">{doctor.full_name}</h2>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {doctor.specialization || "Specialty not listed"}
                </p>
              </div>
            </div>

            <div className="mt-5 border-t border-border pt-4">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Availability</span>
                <StatusBadge value={doctor.availability_status || "Not listed"} />
              </div>

              {canManage && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full"
                  onClick={() => onEdit(doctor)}
                >
                  Edit doctor
                </Button>
              )}

              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold">Weekly schedule</p>

                {schedules
                  .filter((item) => item.doctor_id === doctor.id)
                  .map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between border-t border-border py-2 text-[11px]"
                    >
                      <span>{item.day_of_week}</span>
                      <span className="text-muted-foreground">
                        {item.is_available
                          ? `${formatTime(item.start_time)} – ${formatTime(item.end_time)}`
                          : "Unavailable"}
                      </span>
                    </div>
                  ))}

                {!schedules.some((item) => item.doctor_id === doctor.id) && (
                  <p className="text-xs text-muted-foreground">
                    No schedule is listed.
                  </p>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>

      {doctors.length === 0 && (
        <EmptyMessage>No doctor profiles are available in this clinic.</EmptyMessage>
      )}
    </>
  );
}

function ConsultationsContent({ consultations, appointments, patients, doctors, onCreate }: { consultations: ConsultationRecord[]; appointments: AppointmentRecord[]; patients: PatientRecord[]; doctors: DoctorRecord[]; onCreate: () => void }) {
  return <article className="border border-border bg-card"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4"><div><h2 className="text-sm font-bold">Consultation records</h2><p className="mt-1 text-xs text-muted-foreground">Existing notes and follow-up plans visible to this clinic.</p></div><Button onClick={onCreate} className="gap-2"><Plus className="size-4" />Record consultation</Button></div><ConsultationList consultations={consultations} patients={patients} doctors={doctors} appointments={appointments} /><div className="border-t border-border bg-muted/30 px-5 py-3 text-xs text-muted-foreground">New consultation notes are saved only if the current clinic permissions allow them.</div></article>;
}

function ConsultationList({ consultations, patients, doctors, appointments }: { consultations: ConsultationRecord[]; patients: PatientRecord[]; doctors: DoctorRecord[]; appointments: AppointmentRecord[] }) {
  return <div className="divide-y divide-border">{consultations.map((item) => <div key={item.id} className="px-5 py-4"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">{patientName(patients, item.patient_id)}</p><span className="text-[10px] text-muted-foreground">{item.created_at ? formatDateTime(item.created_at) : "Date not listed"}</span></div><p className="mt-1 text-xs text-muted-foreground">{doctorName(doctors, item.doctor_id)}{item.appointment_id ? ` · ${appointmentReason(appointments, item.appointment_id)}` : ""}</p><p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{item.consultation_notes || "No consultation note entered."}</p>{item.follow_up_date && <p className="mt-2 text-xs text-muted-foreground">Follow-up: {formatDate(item.follow_up_date)}</p>}</div>)}{consultations.length === 0 && <EmptyMessage>No consultation records are available in this clinic.</EmptyMessage>}</div>;
}

function NotificationsContent({ notifications, busy, onRead }: { notifications: NotificationRecord[]; busy: boolean; onRead: (item: NotificationRecord) => void }) {
  return <article className="max-w-4xl border border-border bg-card"><div className="border-b border-border px-5 py-4"><h2 className="text-sm font-bold">Clinic alerts</h2><p className="mt-1 text-xs text-muted-foreground">Alerts are limited to items visible to your clinic membership.</p></div><div className="divide-y divide-border">{notifications.map((item) => <div key={item.id} className={`flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center ${item.is_read ? "" : "bg-primary/[0.025]"}`}><span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Bell className="size-4" /></span><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{item.title}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.message}</p><p className="mt-1 text-[10px] text-muted-foreground">{item.notification_type || "Clinic alert"} · {item.created_at ? formatDateTime(item.created_at) : "Date not listed"}</p></div>{!item.is_read && <Button variant="outline" size="sm" disabled={busy} onClick={() => onRead(item)}>Mark read</Button>}</div>)}{notifications.length === 0 && <EmptyMessage>No clinic alerts are available.</EmptyMessage>}</div></article>;
}

function SettingsContent({ clinic, settings }: { clinic: ClinicWorkspace["clinics"][number]; settings: ClinicWorkspace["settings"][number] | null }) {
  return <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]"><article className="border border-border bg-card p-5 sm:p-6"><div className="border-b border-border pb-4"><h2 className="text-sm font-bold">Clinic information</h2><p className="mt-1 text-xs text-muted-foreground">Details stored for this clinic.</p></div><dl className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">{[["Clinic name", clinic.name], ["Phone", clinic.phone], ["Email", clinic.email], ["Address", clinic.address]].map(([label, value]) => <div key={label}><dt className="text-[11px] text-muted-foreground">{label}</dt><dd className="mt-1 text-sm font-medium">{value || "Not provided"}</dd></div>)}</dl><div className="mt-6 border-t border-border pt-4"><h3 className="text-xs font-semibold">Clinic preferences</h3><pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-muted-foreground">{settings?.settings ? JSON.stringify(settings.settings, null, 2) : "No additional clinic preferences are stored."}</pre></div></article><article className="border border-border bg-card p-5 sm:p-6"><h2 className="text-sm font-bold">Access and administration</h2><p className="mt-1 text-xs text-muted-foreground">What your current clinic access allows.</p><div className="mt-5 space-y-4 text-xs"><div className="border-b border-border pb-3"><p className="font-semibold">Clinic information</p><p className="mt-1 text-muted-foreground">Editing unavailable under current access rules.</p></div><div className="border-b border-border pb-3"><p className="font-semibold">Staff accounts</p><p className="mt-1 text-muted-foreground">Account management is unavailable under current access rules.</p></div><div><p className="font-semibold">Membership</p><p className="mt-1 text-muted-foreground">Clinic membership is verified on sign-in and database records remain protected by RLS.</p></div></div></article></div>;
}

function DemoContent({ section, query, onSection }: { section: Section; query: string; onSection: (section: Section) => void }) {
  const patients = initialPatients.filter((item) => !query || `${item.name} ${item.phone} ${item.id}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  if (section === "Overview") return <>
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{[
      { title: "Total patients", value: "1,248", icon: Users, tint: "text-primary bg-primary/10" },
      { title: "Appointments", value: "24", icon: CalendarDays, tint: "text-care-teal bg-care-teal/12" },
      { title: "Pending screenings", value: "3", icon: Activity, tint: "text-status-warning bg-status-warning/15" },
      { title: "Consultations", value: "31", icon: ClipboardList, tint: "text-status-positive bg-status-positive/12" },
    ].map(({ title, value, icon: Icon, tint }) => <article key={title} className="border border-border bg-card p-5"><div className="flex items-start justify-between"><div><p className="text-xs font-medium text-muted-foreground">{title}</p><p className="mt-3 text-3xl font-bold">{value}</p></div><span className={`flex size-10 items-center justify-center rounded-md ${tint}`}><Icon className="size-5" /></span></div><p className="mt-3 text-[11px] text-muted-foreground">Sample clinic figures</p></article>)}</section>
    <section className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2"><article className="border border-border bg-card"><div className="flex items-center justify-between border-b border-border px-5 py-4"><div><h2 className="text-sm font-bold">Upcoming appointments</h2><p className="mt-1 text-xs text-muted-foreground">Sample schedule</p></div><Button variant="ghost" size="sm" onClick={() => onSection("Appointments")}>View all <ArrowRight className="ml-1 size-3.5" /></Button></div><DemoAppointmentList items={initialAppointments.slice(0, 4)} /></article><article className="border border-border bg-card"><div className="border-b border-border px-5 py-4"><h2 className="text-sm font-bold">Screenings awaiting review</h2><p className="mt-1 text-xs text-muted-foreground">Sample queue</p></div><div className="space-y-3 p-4">{initialTriage.filter((item) => !item.reviewed).slice(0, 3).map((item) => <DemoTriageItem key={item.id} item={item} />)}</div></article></section>
  </>;
  if (section === "Patients") return <article className="overflow-hidden border border-border bg-card"><div className="border-b border-border px-5 py-4"><h2 className="text-sm font-bold">Sample patient directory</h2><p className="mt-1 text-xs text-muted-foreground">{patients.length} fictional demo records · registration and editing are not available</p></div><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left"><thead className="bg-muted/50"><tr className="text-[10px] font-semibold uppercase text-muted-foreground"><th className="px-5 py-3">Patient</th><th className="px-3 py-3">Sample ID</th><th className="px-3 py-3">Age / gender</th><th className="px-5 py-3">Phone</th></tr></thead><tbody>{patients.map((item) => <tr key={item.id} className="border-t border-border text-xs"><td className="px-5 py-3">{item.name}</td><td className="px-3 py-3 text-muted-foreground">{item.id}</td><td className="px-3 py-3 text-muted-foreground">{item.age} / {item.gender}</td><td className="px-5 py-3 text-muted-foreground">{item.phone}</td></tr>)}</tbody></table></div></article>;
  if (section === "Appointments") return <article className="overflow-hidden border border-border bg-card"><div className="border-b border-border px-5 py-4"><h2 className="text-sm font-bold">Sample appointments</h2><p className="mt-1 text-xs text-muted-foreground">Sample records cannot be changed or saved.</p></div><DemoAppointmentList items={initialAppointments} /></article>;
  if (section === "Triage Queue") return <article className="border border-border bg-card"><div className="border-b border-border px-5 py-4"><h2 className="text-sm font-bold">Sample triage queue</h2><p className="mt-1 text-xs text-muted-foreground">Fictional screening entries for preview only.</p></div><div className="space-y-3 p-4">{initialTriage.map((item) => <DemoTriageItem key={item.id} item={item} />)}</div><p className="border-t border-border px-5 py-4 text-xs text-muted-foreground">Clinical review actions are not available in the sample workspace.</p></article>;
  if (section === "Doctors") return <><div className="mb-4 border-l-4 border-l-status-warning bg-status-warning/10 px-4 py-3 text-xs"><p className="font-semibold">Doctor and schedule editing is unfinished</p><p className="mt-1 text-muted-foreground">Sample profiles are shown for preview. Live editing is disabled by current database permissions.</p></div><div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{initialDoctors.map((doctor) => <article key={doctor.id} className="border border-border bg-card p-5"><div className="flex items-center gap-3"><PersonAvatar name={doctor.name} /><div><p className="text-sm font-semibold">{doctor.name}</p><p className="mt-1 text-xs text-muted-foreground">{doctor.specialty}</p></div></div><p className="mt-4 text-xs text-muted-foreground">{doctor.hours} · {doctor.availability}</p></article>)}</div></>;
  if (section === "Consultations") return <article className="border border-border bg-card"><div className="border-b border-border px-5 py-4"><h2 className="text-sm font-bold">Sample consultation visits</h2><p className="mt-1 text-xs text-muted-foreground">Appointments marked in consultation or completed are illustrative only.</p></div><DemoAppointmentList items={initialAppointments.filter((item) => item.status === "Checked In" || item.status === "In Consultation" || item.status === "Completed")} /></article>;
  if (section === "Notifications") return <article className="max-w-4xl border border-border bg-card"><div className="border-b border-border px-5 py-4"><h2 className="text-sm font-bold">Sample clinic alerts</h2><p className="mt-1 text-xs text-muted-foreground">Illustrative notifications only; no live clinic alerts were found.</p></div>{initialTriage.filter((item) => !item.reviewed).map((item) => <div key={item.id} className="flex items-start gap-3 border-b border-border px-5 py-4"><span className="flex size-9 items-center justify-center rounded-full bg-destructive/10 text-destructive"><Bell className="size-4" /></span><div><p className="text-sm font-semibold">Screening needs review</p><p className="mt-1 text-xs text-muted-foreground">{item.patient} · {item.summary}</p></div></div>)}</article>;
  return <div className="border border-border bg-card p-6"><h2 className="text-sm font-bold">Settings are not connected</h2><p className="mt-2 text-sm text-muted-foreground">Clinic details and staff accounts are not editable in this sample workspace.</p></div>;
}

function DemoAppointmentList({ items }: { items: DemoAppointment[] }) {
  return <div className="divide-y divide-border">{items.map((item) => <div key={item.id} className="flex flex-wrap items-center gap-3 px-5 py-3"><PersonAvatar name={item.patient} /><div className="min-w-40 flex-1"><p className="text-xs font-semibold">{item.patient}</p><p className="mt-1 text-[10px] text-muted-foreground">{item.reason}</p></div><span className="text-xs text-muted-foreground">{item.date} · {item.time}</span><StatusBadge value={item.status} /></div>)}</div>;
}

function DemoTriageItem({ item }: { item: DemoTriage }) {
  return <div className={`flex flex-col gap-2 border border-border p-4 sm:flex-row sm:items-center ${item.priority === "Emergency" ? "border-l-4 border-l-priority-emergency" : ""}`}><PersonAvatar name={item.patient} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">{item.patient}</p><PriorityBadge value={item.priority} /></div><p className="mt-1 text-xs text-muted-foreground">{item.summary}</p></div><span className="text-xs text-muted-foreground">{item.reviewed ? "Reviewed" : "Needs review"}</span></div>;
}

function AppointmentDialog({ open, onOpenChange, patients, doctors, busy, onSubmit }: { open: boolean; onOpenChange: (open: boolean) => void; patients: PatientRecord[]; doctors: DoctorRecord[]; busy: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[520px]"><DialogHeader><DialogTitle>Schedule appointment</DialogTitle><DialogDescription>Choose a patient and doctor from this clinic.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={onSubmit}><label className="block space-y-1.5 text-xs font-medium">Patient<Select name="patient" required><SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger><SelectContent>{patients.map((item) => <SelectItem key={item.id} value={item.id}>{item.full_name}</SelectItem>)}</SelectContent></Select></label><label className="block space-y-1.5 text-xs font-medium">Doctor<Select name="doctor" required><SelectTrigger><SelectValue placeholder="Select doctor" /></SelectTrigger><SelectContent>{doctors.map((item) => <SelectItem key={item.id} value={item.id}>{item.full_name}{item.specialization ? ` · ${item.specialization}` : ""}</SelectItem>)}</SelectContent></Select></label><div className="grid grid-cols-2 gap-3"><label className="block space-y-1.5 text-xs font-medium">Date<Input type="date" name="date" required /></label><label className="block space-y-1.5 text-xs font-medium">Time<Input type="time" name="time" required /></label></div><label className="block space-y-1.5 text-xs font-medium">Reason for visit<Input name="reason" maxLength={500} required placeholder="Appointment reason" /></label><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={busy || patients.length === 0 || doctors.length === 0}>{busy ? "Saving…" : "Save appointment"}</Button></DialogFooter>{(patients.length === 0 || doctors.length === 0) && <p className="text-xs text-muted-foreground">A patient and doctor must be available before scheduling.</p>}</form></DialogContent></Dialog>;
}

function ConsultationDialog({ open, onOpenChange, patients, doctors, appointments, selectedAppointment, busy, onSubmit }: { open: boolean; onOpenChange: (open: boolean) => void; patients: PatientRecord[]; doctors: DoctorRecord[]; appointments: AppointmentRecord[]; selectedAppointment: AppointmentRecord | null; busy: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[540px]"><DialogHeader><DialogTitle>Record consultation</DialogTitle><DialogDescription>Notes are saved only when the clinic permits staff consultation records.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={onSubmit}><label className="block space-y-1.5 text-xs font-medium">Patient<Select name="patient" defaultValue={selectedAppointment?.patient_id ?? "none"} required><SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger><SelectContent><SelectItem value="none" disabled>Select patient</SelectItem>{patients.map((item) => <SelectItem key={item.id} value={item.id}>{item.full_name}</SelectItem>)}</SelectContent></Select></label><label className="block space-y-1.5 text-xs font-medium">Appointment (optional)<Select name="appointment" defaultValue={selectedAppointment?.id ?? "none"}><SelectTrigger><SelectValue placeholder="Link to appointment" /></SelectTrigger><SelectContent><SelectItem value="none">No appointment selected</SelectItem>{appointments.map((item) => <SelectItem key={item.id} value={item.id}>{formatDate(item.appointment_date)} · {patientName(patients, item.patient_id)}</SelectItem>)}</SelectContent></Select></label><label className="block space-y-1.5 text-xs font-medium">Doctor<Select name="doctor" defaultValue={selectedAppointment?.doctor_id ?? "none"}><SelectTrigger><SelectValue placeholder="Select doctor" /></SelectTrigger><SelectContent><SelectItem value="none">Not assigned</SelectItem>{doctors.map((item) => <SelectItem key={item.id} value={item.id}>{item.full_name}</SelectItem>)}</SelectContent></Select></label><label className="block space-y-1.5 text-xs font-medium">Consultation notes<Textarea name="notes" rows={5} required maxLength={10000} placeholder="Enter relevant clinical observations and care provided…" /></label><label className="block space-y-1.5 text-xs font-medium">Follow-up date (optional)<Input type="date" name="followUpDate" /></label><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={busy || patients.length === 0}>{busy ? "Saving…" : "Save consultation"}</Button></DialogFooter></form></DialogContent></Dialog>;
}

function PersonAvatar({ name }: { name: string }) {
  const initials = name.split(/\s+/).map((part) => part[0] ?? "").slice(0, 2).join("").toUpperCase();
  return <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold text-secondary-foreground">{initials || <UserRound className="size-4" />}</span>;
}

function DoctorRow({ doctor }: { doctor: DoctorRecord }) {
  return <div className="flex items-center gap-3"><PersonAvatar name={doctor.full_name} /><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{doctor.full_name}</p><p className="mt-1 truncate text-[10px] text-muted-foreground">{doctor.specialization || "Specialty not listed"}</p></div><StatusBadge value={doctor.availability_status || "Not listed"} /></div>;
}

function StatusBadge({ value }: { value: string }) {
  const normalized = value.toLocaleLowerCase().replaceAll("_", " ");
  const tone = normalized.includes("complete") || normalized.includes("available") || normalized.includes("reviewed") ? "bg-status-positive/12 text-status-positive" : normalized.includes("pending") || normalized.includes("consultation") ? "bg-status-warning/15 text-status-warning" : normalized.includes("cancel") || normalized.includes("no show") ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary";
  return <Badge className={`whitespace-nowrap border-0 capitalize ${tone}`}>{normalized}</Badge>;
}

function PriorityBadge({ value }: { value: string }) {
  const tone = value === "Emergency" ? "bg-priority-emergency/10 text-priority-emergency" : value === "Moderate" ? "bg-priority-moderate/15 text-priority-moderate" : "bg-priority-mild/12 text-priority-mild";
  return <Badge className={`border-0 ${tone}`}>{value}</Badge>;
}

function MiniMetric({ label, value, icon: Icon, tone = "normal" }: { label: string; value: number; icon: typeof Clock3; tone?: "normal" | "emergency" | "positive" }) {
  const color = tone === "emergency" ? "bg-destructive/10 text-destructive" : tone === "positive" ? "bg-status-positive/12 text-status-positive" : "bg-primary/10 text-primary";
  return <article className="flex items-center justify-between border border-border bg-card p-4"><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></div><span className={`flex size-9 items-center justify-center rounded-md ${color}`}><Icon className="size-4" /></span></article>;
}

function EmptyMessage({ children }: { children: React.ReactNode }) {
  return <p className="px-5 py-10 text-center text-sm text-muted-foreground">{children}</p>;
}

function RouteError({ message }: { message: string }) {
  return <main className="flex min-h-screen items-center justify-center bg-background px-5"><div className="max-w-md border border-border bg-card p-6 text-center"><ShieldCheck className="mx-auto size-8 text-destructive" /><h1 className="mt-4 font-display text-lg font-bold">Clinic workspace unavailable</h1><p className="mt-2 text-sm text-muted-foreground">{message}</p><p className="mt-3 text-xs text-muted-foreground">Your clinic administrator can help review your account access.</p></div></main>;
}

function patientName(patients: PatientRecord[], patientId: string) {
  return patients.find((item) => item.id === patientId)?.full_name ?? "Patient record";
}

function doctorName(doctors: DoctorRecord[], doctorId: string | null) {
  return doctorId ? doctors.find((item) => item.id === doctorId)?.full_name ?? "Doctor not listed" : "Unassigned";
}

function appointmentReason(appointments: AppointmentRecord[], appointmentId: string) {
  return appointments.find((item) => item.id === appointmentId)?.reason || "Appointment";
}

function normalizeStatus(status: string | null) {
  return (status || "Pending").toLocaleLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizePriority(value: string) {
  const normalized = value.toLocaleLowerCase();
  if (normalized.includes("emergency") || normalized.includes("urgent") || normalized.includes("high")) return "Emergency";
  if (normalized.includes("moderate") || normalized.includes("medium")) return "Moderate";
  return "Mild";
}

function formatToday() {
  return new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date());
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function formatTime(value: string) {
  const [hoursPart, minutesPart] = value.split(":");
  const hours = Number(hoursPart);
  const minutes = Number(minutesPart);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return value;
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(2000, 0, 1, hours, minutes));
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}
