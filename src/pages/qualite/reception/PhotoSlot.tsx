import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Camera, Loader2, Trash2, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import { compressImage } from "@/lib/reception";
import { cn } from "@/lib/utils";
import { CameraCaptureDialog } from "./CameraCaptureDialog";


interface Props {
  ticketId?: string; // undefined tant que le ticket n'existe pas
  ticketNumero?: string;
  supplierName?: string;
  campaignId?: string | null;
  slot: 1 | 2 | 3;
  disabled?: boolean;
  storagePath?: string | null;
  onUploaded: (path: string) => void;
  onDeleted: () => void;
}

const MAX_BYTES = 5 * 1024 * 1024;

export function PhotoSlot({ ticketId, ticketNumero, supplierName, campaignId, slot, disabled, storagePath, onUploaded, onDeleted }: Props) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"" | "compress" | "upload">("");
  const [preview, setPreview] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);


  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!storagePath) return setPreview(null);
      const { data } = await supabase.storage.from("reception-photos").createSignedUrl(storagePath, 3600);
      if (!cancel) setPreview(data?.signedUrl ?? null);
    })();
    return () => {
      cancel = true;
    };
  }, [storagePath]);

  async function handleFile(file: File) {
    if (!ticketId) {
      toast.error("Enregistrez le ticket avant d'ajouter des photos");
      return;
    }
    setBusy(true);
    setPhase("compress");
    setProgress(10);
    try {
      const blob = await compressImage(file, 2560, 0.92, MAX_BYTES);
      if (blob.size > MAX_BYTES) {
        throw new Error("Photo > 5 Mo malgré compression — réessayez avec moins de zoom");
      }
      setPhase("upload");
      setProgress(45);
      // Progression estimée pendant l'envoi (le SDK ne remonte pas d'événement).
      const tick = setInterval(() => setProgress((p) => (p < 90 ? p + 5 : p)), 350);
      // Organisation Supabase: reception-photos/{campagne}/{ticket_id}/photoN-<uuid>.jpg
      const camp = campaignId ?? "sans-campagne";
      const path = `${camp}/${ticketId}/photo${slot}-${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage
        .from("reception-photos")
        .upload(path, blob, { contentType: "image/jpeg", upsert: false });
      clearInterval(tick);
      if (error) throw error;
      setProgress(100);
      onUploaded(path);
      toast.success(`Photo ${slot} enregistrée (${(blob.size / 1024 / 1024).toFixed(2)} Mo)`);
    } catch (e: any) {
      toast.error(e.message ?? "Erreur d'envoi");
    } finally {
      setBusy(false);
      setPhase("");
      setProgress(0);
    }
  }


  async function handleDelete() {
    if (!storagePath) return;
    setBusy(true);
    try {
      await supabase.storage.from("reception-photos").remove([storagePath]);
      onDeleted();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={cn(
        "relative rounded-lg border-2 border-dashed p-3 flex flex-col items-center justify-center min-h-[180px] bg-muted/20",
        storagePath && "border-solid border-primary/40",
      )}
    >
      <div className="absolute top-2 left-2 text-xs font-semibold bg-background/80 rounded px-1.5 py-0.5">
        Photo {slot}
      </div>
      {preview ? (
        <>
          <button type="button" onClick={() => setZoomOpen(true)} className="block group relative">
            <img src={preview} alt={`Photo ${slot}`} className="max-h-40 rounded object-contain" />
            <ZoomIn className="absolute top-2 right-2 h-4 w-4 opacity-70 group-hover:opacity-100" />
          </button>
          {!disabled && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2 text-destructive"
              onClick={handleDelete}
              disabled={busy}
            >
              <Trash2 className="h-4 w-4 mr-1" /> Reprendre
            </Button>
          )}
        </>
      ) : (
        <div className={cn("flex flex-col items-center gap-2 w-full", disabled && "opacity-50 pointer-events-none")}>
          {busy ? <Loader2 className="h-8 w-8 animate-spin" /> : <Camera className="h-8 w-8 text-muted-foreground" />}
          {busy ? (
            <div className="w-full max-w-[180px]">
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1 text-center tabular-nums">
                {phase === "compress" ? "Compression…" : "Envoi…"} {progress}%
              </p>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">Prendre la photo</span>
          )}

          <Button
            type="button"
            size="sm"
            onClick={() => {
              if (!ticketId) {
                toast.error("Enregistrez le ticket avant d'ajouter des photos");
                return;
              }
              setCameraOpen(true);
            }}
            disabled={disabled || busy}
          >
            <Camera className="h-4 w-4 mr-1.5" /> Ouvrir la caméra
          </Button>
        </div>
      )}
      <CameraCaptureDialog
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        slot={slot}
        ticketNumero={ticketNumero}
        supplierName={supplierName}
        onCapture={(file) => handleFile(file)}
      />
      <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
        <DialogContent className="max-w-4xl p-2 bg-black/95">
          {preview && (
            <img src={preview} alt={`Photo ${slot}`} className="w-full h-auto max-h-[80vh] object-contain rounded" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );

}
