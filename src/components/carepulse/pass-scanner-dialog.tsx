import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Camera, CheckCircle2, ImageUp, Loader2, RotateCcw, ScanLine, ShieldCheck, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  PASS_SERVICE_ERROR, parsePassQr, passRejectionMessages, passRejectionTitles,
  type PassDetails, type PassScanResult,
} from "@/lib/carepulse-pass";
import { checkInPatientPass, verifyPatientPass } from "@/lib/carepulse-pass.functions";

type Phase =
  | { kind: "scanning" }
  | { kind: "verifying" }
  | { kind: "checking_in"; pass: PassDetails }
  | { kind: "result"; result: PassScanResult }
  | { kind: "error"; message: string };

type CameraState = { kind: "starting" } | { kind: "live" } | { kind: "unavailable"; message: string };

function friendlyError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("Unauthorized")) return "Your sign-in has expired. Please sign in again.";
  return PASS_SERVICE_ERROR;
}

function cameraErrorMessage(error: unknown) {
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  if (/NotAllowed|Permission|denied/i.test(text)) return "Camera access was blocked. Allow camera access in your browser, or upload a photo of the QR code.";
  if (/not found|NotFound|no camera|Overconstrained/i.test(text)) return "No camera was found on this device. Upload a photo of the QR code instead.";
  if (/insecure/i.test(text)) return "The camera needs a secure (https) page. Upload a photo of the QR code instead.";
  return "The camera couldn't start. If you're in the editor preview, open the app in a new tab, or upload a photo of the QR code.";
}

export function PassScannerDialog({ open, onOpenChange, clinicId, clinicName, onCheckedIn }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clinicId: string;
  clinicName: string;
  onCheckedIn: (pass: PassDetails) => void;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: "scanning" });
  const [camera, setCamera] = useState<CameraState>({ kind: "starting" });
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  // The scanned text holds the secret token: keep it out of state and the screen, and drop it once used.
  const scannedRef = useRef<string | null>(null);
  const handlingRef = useRef(false);
  const handleRef = useRef<(text: string) => Promise<void>>(async () => {});
  const verifyFn = useServerFn(verifyPatientPass);
  const checkInFn = useServerFn(checkInPatientPass);

  function reset() {
    scannedRef.current = null;
    handlingRef.current = false;
    setPhase({ kind: "scanning" });
  }

  useEffect(() => {
    if (!open) {
      scannedRef.current = null;
      handlingRef.current = false;
      setPhase({ kind: "scanning" });
    }
  }, [open]);

  async function handleDecoded(text: string) {
    if (handlingRef.current) return;
    handlingRef.current = true;
    if (!parsePassQr(text)) {
      setPhase({ kind: "result", result: { outcome: "rejected", reason: "unreadable", message: passRejectionMessages.unreadable, pass: null } });
      return;
    }
    scannedRef.current = text;
    setPhase({ kind: "verifying" });
    try {
      const result = await verifyFn({ data: { clinicId, qrText: text } });
      if (result.outcome !== "verified") scannedRef.current = null;
      setPhase({ kind: "result", result });
    } catch (error) {
      scannedRef.current = null;
      setPhase({ kind: "error", message: friendlyError(error) });
    }
  }

  useEffect(() => {
    handleRef.current = handleDecoded;
  });

  const scanning = open && phase.kind === "scanning";

  useEffect(() => {
    if (!scanning || !video) return;
    let cancelled = false;
    let scanner: { stop: () => void; destroy: () => void } | null = null;
    setCamera({ kind: "starting" });
    void (async () => {
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error("insecure");
        const { default: QrScanner } = await import("qr-scanner");
        if (cancelled) return;
        const instance = new QrScanner(video, (result) => { void handleRef.current(result.data); }, {
          preferredCamera: "environment",
          maxScansPerSecond: 6,
          returnDetailedScanResult: true,
        });
        scanner = instance;
        await instance.start();
        if (!cancelled) setCamera({ kind: "live" });
      } catch (error) {
        if (!cancelled) setCamera({ kind: "unavailable", message: cameraErrorMessage(error) });
      }
    })();
    return () => {
      cancelled = true;
      scanner?.stop();
      scanner?.destroy();
    };
  }, [scanning, video]);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    let text: string;
    try {
      const { default: QrScanner } = await import("qr-scanner");
      text = (await QrScanner.scanImage(file, { returnDetailedScanResult: true })).data;
    } catch {
      handlingRef.current = true;
      setPhase({ kind: "result", result: { outcome: "rejected", reason: "unreadable", message: "No QR code was found in that photo. Try a clearer photo or use the camera.", pass: null } });
      return;
    }
    await handleDecoded(text);
  }

  async function checkIn(pass: PassDetails) {
    const text = scannedRef.current;
    if (!text) {
      reset();
      return;
    }
    setPhase({ kind: "checking_in", pass });
    try {
      const result = await checkInFn({ data: { clinicId, qrText: text } });
      scannedRef.current = null;
      setPhase({ kind: "result", result });
      if (result.outcome === "checked_in") onCheckedIn(result.pass);
    } catch (error) {
      scannedRef.current = null;
      setPhase({ kind: "error", message: friendlyError(error) });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] w-[calc(100vw-1.5rem)] max-w-md overflow-y-auto p-5 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ScanLine className="size-5 text-primary" />Scan Patient QR</DialogTitle>
          <DialogDescription>Scan the appointment pass in the patient's CarePulse app to check them in at {clinicName}.</DialogDescription>
        </DialogHeader>

        {phase.kind === "scanning" && (
          <div className="space-y-3">
            <div className="relative aspect-square w-full overflow-hidden rounded-md bg-foreground">
              <video ref={setVideo} className="h-full w-full object-cover" muted playsInline aria-label="Camera view for scanning the patient's QR pass" />
              {camera.kind === "live" && <div aria-hidden className="pointer-events-none absolute inset-[15%] rounded-md border-2 border-primary-foreground/85" />}
              {camera.kind === "starting" && <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-primary-foreground/85"><Loader2 className="size-6 animate-spin" />Starting camera…</div>}
              {camera.kind === "unavailable" && <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-sm text-primary-foreground/90"><Camera className="size-7" /><p>{camera.message}</p></div>}
            </div>
            <p className="text-center text-xs text-muted-foreground">{camera.kind === "live" ? "Hold the QR code inside the frame." : "You can also scan from a photo."}</p>
            <label className="flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-background text-sm font-medium hover:bg-accent hover:text-accent-foreground focus-within:ring-2 focus-within:ring-ring">
              <ImageUp className="size-4" />Upload a photo of the QR code
              <input type="file" accept="image/*" className="sr-only" onChange={handleFile} />
            </label>
            <p className="flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground"><ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-care-teal" />Passes are verified securely for your clinic. The pass's secret code is never shown on screen.</p>
          </div>
        )}

        {phase.kind === "verifying" && <div className="flex flex-col items-center justify-center gap-3 py-14 text-sm text-muted-foreground"><Loader2 className="size-7 animate-spin text-primary" />Checking pass…</div>}

        {phase.kind === "checking_in" && (
          <div className="space-y-4">
            <PassDetailsCard pass={phase.pass} />
            <Button className="h-11 w-full gap-2" disabled><Loader2 className="size-4 animate-spin" />Checking in…</Button>
          </div>
        )}

        {phase.kind === "result" && phase.result.outcome === "verified" && (() => {
          const pass = phase.result.pass;
          return (
            <div className="space-y-4">
              <ResultBanner tone="positive" title="Pass verified" message="This pass is valid for today's confirmed appointment." />
              <PassDetailsCard pass={pass} />
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <Button variant="outline" className="h-11 flex-1 gap-2" onClick={reset}><RotateCcw className="size-4" />Scan another</Button>
                <Button className="h-11 flex-1 gap-2" onClick={() => void checkIn(pass)}><CheckCircle2 className="size-4" />Check in patient</Button>
              </div>
            </div>
          );
        })()}

        {phase.kind === "result" && phase.result.outcome === "checked_in" && (
          <div className="space-y-4">
            <ResultBanner tone="positive" title="Patient checked in" message={`${phase.result.pass.patientName} is checked in. The pass can't be used again.`} />
            <PassDetailsCard pass={phase.result.pass} />
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button variant="outline" className="h-11 flex-1" onClick={() => onOpenChange(false)}>Done</Button>
              <Button className="h-11 flex-1 gap-2" onClick={reset}><ScanLine className="size-4" />Scan next patient</Button>
            </div>
          </div>
        )}

        {phase.kind === "result" && phase.result.outcome === "rejected" && (
          <div className="space-y-4">
            <ResultBanner tone="negative" title={passRejectionTitles[phase.result.reason]} message={phase.result.message} />
            {phase.result.pass && <PassDetailsCard pass={phase.result.pass} />}
            <Button className="h-11 w-full gap-2" onClick={reset}><RotateCcw className="size-4" />Scan again</Button>
          </div>
        )}

        {phase.kind === "error" && (
          <div className="space-y-4">
            <ResultBanner tone="negative" title="Couldn't check the pass" message={phase.message} />
            <Button className="h-11 w-full gap-2" onClick={reset}><RotateCcw className="size-4" />Try again</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ResultBanner({ tone, title, message }: { tone: "positive" | "negative"; title: string; message: string }) {
  const positive = tone === "positive";
  const Icon = positive ? CheckCircle2 : XCircle;
  return (
    <div role={positive ? "status" : "alert"} className={`flex gap-3 border-l-4 px-4 py-3 ${positive ? "border-l-status-positive bg-status-positive/10" : "border-l-destructive bg-destructive/10"}`}>
      <Icon className={`mt-0.5 size-5 shrink-0 ${positive ? "text-status-positive" : "text-destructive"}`} />
      <div><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{message}</p></div>
    </div>
  );
}

const statusLabels: Record<string, string> = {
  pending: "Pending", confirmed: "Confirmed", checked_in: "Checked in", completed: "Completed", cancelled: "Cancelled", rescheduled: "Rescheduled",
};

function PassDetailsCard({ pass }: { pass: PassDetails }) {
  const rows: [string, string][] = [
    ["Date", formatPassDate(pass.appointmentDate)],
    ["Time", formatPassTime(pass.appointmentTime)],
    ["Doctor", pass.doctorName ?? "Not assigned"],
    ["Reason", pass.reason || "—"],
    ["Status", statusLabels[pass.status] ?? pass.status],
    ["Pass reference", pass.referenceCode],
  ];
  return (
    <article className="border border-border bg-card">
      <div className="border-b border-border px-4 py-3"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Patient</p><p className="mt-1 text-base font-semibold">{pass.patientName}</p><p className="text-xs text-muted-foreground">{pass.clinicName}</p></div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 px-4 py-3 text-xs">
        {rows.map(([label, value]) => <div key={label} className="contents"><dt className="text-muted-foreground">{label}</dt><dd className={`text-right font-medium ${label === "Pass reference" ? "font-mono" : ""}`}>{value}</dd></div>)}
      </dl>
    </article>
  );
}

function formatPassDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function formatPassTime(value: string) {
  const [hours, minutes] = value.split(":");
  const h = Number(hours);
  if (Number.isNaN(h) || minutes === undefined) return value;
  return `${((h + 11) % 12) + 1}:${minutes} ${h < 12 ? "AM" : "PM"}`;
}
