import * as React from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface SupplierOption {
  id: string;
  code?: string | null;
  nom?: string | null;
}

interface Props {
  suppliers: SupplierOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Sélecteur fournisseur avec recherche.
 * Popover + input natif : la saisie fonctionne correctement sur mobile/tablette
 * (contrairement à un champ placé dans un Radix Select, qui perd le focus au tap).
 */
export function SupplierCombobox({ suppliers, value, onChange, placeholder = "Sélectionner", className }: Props) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const selected = suppliers.find((s) => s.id === value);

  const filtered = React.useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return suppliers;
    return suppliers.filter(
      (s) => (s.nom ?? "").toLowerCase().includes(t) || (s.code ?? "").toLowerCase().includes(t),
    );
  }, [suppliers, q]);

  React.useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
    setQ("");
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("h-11 w-full justify-between font-normal", !selected && "text-muted-foreground", className)}
        >
          <span className="truncate">
            {selected ? (
              <>
                <span className="font-mono text-xs mr-2">{selected.code}</span>
                {selected.nom}
              </>
            ) : (
              placeholder
            )}
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        collisionPadding={8}
        className="p-0 w-[--radix-popover-trigger-width] max-w-[calc(100vw-1rem)]"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              inputMode="search"
              placeholder="Rechercher par nom ou code…"
              className="h-10 pl-8"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>
        <div className="max-h-[45vh] overflow-y-auto overscroll-contain py-1">
          {filtered.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                onChange(s.id);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-accent",
                s.id === value && "bg-accent/60",
              )}
            >
              <Check className={cn("h-4 w-4 shrink-0", s.id === value ? "opacity-100" : "opacity-0")} />
              <span className="font-mono text-xs">{s.code}</span>
              <span className="truncate">{s.nom}</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">Aucun fournisseur</div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
