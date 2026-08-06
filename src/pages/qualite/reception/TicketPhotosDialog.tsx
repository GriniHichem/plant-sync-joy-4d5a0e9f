import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ImageOff, ZoomIn } from "lucide-react";


interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  ticketId: string | null;
  ticketNumero?: string;
}

export function TicketPhotosDialog({ open, onOpenChange, ticketId, ticketNumero }: Props) {
  const [loading, setLoading] = useState(false);
  const [photos, setPhotos] = useState<Array<{ slot: number; url: string | null; uploaded_at: string }>>([]);

  useEffect(() => {
    if (!open || !ticketId) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from("reception_ticket_photos" as any)
          .select("slot, storage_path, uploaded_at")
          .eq("ticket_id", ticketId)
          .order("slot");
        const rows = (data ?? []) as any[];
        const withUrls = await Promise.all(
          rows.map(async (r) => {
            const { data: s } = await supabase.storage
              .from("reception-photos")
              .createSignedUrl(r.storage_path, 300);
            return { slot: r.slot, url: s?.signedUrl ?? null, uploaded_at: r.uploaded_at };
          }),
        );
        if (!cancel) setPhotos(withUrls);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [open, ticketId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] sm:w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto p-4 sm:p-6 pr-10 sm:pr-6">
        <DialogHeader>
          <DialogTitle>Photos du ticket {ticketNumero ?? ""}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Chargement…
          </div>
        ) : photos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <ImageOff className="h-8 w-8 mb-2" />
            Aucune photo enregistrée
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {photos.map((p) => (
              <div key={p.slot} className="border rounded-lg overflow-hidden bg-muted/20">
                <div className="px-2 py-1 text-xs font-medium bg-muted/50 flex items-center justify-between">
                  <span>Photo {p.slot}</span>
                  <span className="text-muted-foreground">
                    {new Date(p.uploaded_at).toLocaleString("fr-FR", {
                      day: "2-digit", month: "2-digit", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </span>
                </div>
                {p.url ? (
                  <a href={p.url} target="_blank" rel="noreferrer" className="relative block group">
                    <img src={p.url} alt={`Photo ${p.slot}`} className="w-full aspect-[4/3] object-cover" />
                    <ZoomIn className="absolute top-2 right-2 h-4 w-4 text-white drop-shadow opacity-80 group-hover:opacity-100" />
                  </a>
                ) : (
                  <div className="aspect-[4/3] flex items-center justify-center text-muted-foreground">
                    <ImageOff className="h-6 w-6" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
