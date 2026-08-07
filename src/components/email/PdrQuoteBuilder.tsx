import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Package, Search, Truck, X, Wand2, ImageIcon } from "lucide-react";

export interface QuoteDraft {
  to: string;
  subject: string;
  body: string;
  attachments: { filename: string; url: string }[];
}

interface PdrRow {
  id: string;
  reference: string;
  designation: string;
  marque: string | null;
  modele: string | null;
  reference_constructeur: string | null;
  matiere: string | null;
  unite_stock: string | null;
  description: string | null;
  commentaire_technique: string | null;
}

interface SupplierRow {
  id: string;
  nom: string;
  email: string | null;
  tel: string | null;
  source: "pdr" | "famille";
}

interface PhotoRow {
  id: string;
  entity_id: string;
  image_url: string;
  file_name: string | null;
}

const FIELDS = [
  { key: "code", label: "Code produit" },
  { key: "designation", label: "Désignation" },
  { key: "caracteristiques", label: "Caractéristiques industrielles" },
  { key: "quantite", label: "Quantité souhaitée" },
  { key: "date_livraison", label: "Date de livraison souhaitée" },
  { key: "conditionnement", label: "Conditionnement" },
  { key: "photos", label: "Photos du produit" },
  { key: "commentaires", label: "Commentaires libres" },
] as const;

type FieldKey = (typeof FIELDS)[number]["key"];

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function caracteristiques(p: PdrRow): string {
  return [
    p.marque && `Marque : ${p.marque}`,
    p.modele && `Modèle : ${p.modele}`,
    p.reference_constructeur && `Réf. constructeur : ${p.reference_constructeur}`,
    p.matiere && `Matière : ${p.matiere}`,
    p.commentaire_technique,
    p.description,
  ].filter(Boolean).join(" · ");
}

export function PdrQuoteBuilder({ onDraft }: { onDraft: (d: QuoteDraft) => void }) {
  const [search, setSearch] = useState("");
  const [machineId, setMachineId] = useState<string>("all");
  const [familyId, setFamilyId] = useState<string>("all");
  const [machines, setMachines] = useState<{ id: string; label: string }[]>([]);
  const [families, setFamilies] = useState<{ id: string; label: string }[]>([]);
  const [results, setResults] = useState<PdrRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<PdrRow[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [pickedSuppliers, setPickedSuppliers] = useState<string[]>([]);
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [pickedPhotos, setPickedPhotos] = useState<string[]>([]);
  const [fields, setFields] = useState<Record<FieldKey, boolean>>({
    code: true, designation: true, caracteristiques: true, quantite: true,
    date_livraison: true, conditionnement: false, photos: true, commentaires: false,
  });
  const [qty, setQty] = useState<Record<string, string>>({});
  const [deliveryDate, setDeliveryDate] = useState("");
  const [packaging, setPackaging] = useState("");
  const [comments, setComments] = useState("");

  // Options de filtres (machines / familles)
  useEffect(() => {
    (async () => {
      const [m, f] = await Promise.all([
        supabase.from("machines").select("id, code, designation").order("code").limit(500),
        supabase.from("pdr_families").select("id, name").eq("is_active", true).order("name").limit(500),
      ]);
      setMachines(((m.data ?? []) as any[]).map((r) => ({ id: r.id, label: `${r.code} — ${r.designation}` })));
      setFamilies(((f.data ?? []) as any[]).map((r) => ({ id: r.id, label: r.name })));
    })();
  }, []);

  // Recherche PDR (texte et/ou filtres machine/famille)
  useEffect(() => {
    const q = search.trim();
    const hasFilter = machineId !== "all" || familyId !== "all";
    if (q.length < 2 && !hasFilter) { setResults([]); return; }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      let machinePdrIds: string[] | null = null;
      if (machineId !== "all") {
        const { data } = await supabase.from("machine_pdr").select("pdr_id").eq("machine_id" as any, machineId) as any;
        machinePdrIds = ((data ?? []) as any[]).map((r) => r.pdr_id);
        if (machinePdrIds.length === 0) {
          if (!cancelled) { setResults([]); setSearching(false); }
          return;
        }
      }
      let query = supabase
        .from("pdr")
        .select("id, reference, designation, marque, modele, reference_constructeur, matiere, unite_stock, description, commentaire_technique, family_id")
        .eq("is_active" as any, true) as any;
      if (familyId !== "all") query = query.eq("family_id", familyId);
      if (machinePdrIds) query = query.in("id", machinePdrIds);
      if (q.length >= 2) query = query.or(`reference.ilike.%${q}%,designation.ilike.%${q}%`);
      const { data } = await query.order("reference").limit(hasFilter ? 100 : 20);
      if (cancelled) return;
      setResults((data as PdrRow[]) ?? []);
      setSearching(false);
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [search, machineId, familyId]);


  const pickedIds = useMemo(() => picked.map((p) => p.id), [picked]);
  const idsKey = pickedIds.join("|");

  // Fournisseurs + photos des PDR sélectionnés
  useEffect(() => {
    if (pickedIds.length === 0) { setSuppliers([]); setPhotos([]); return; }
    let cancelled = false;
    (async () => {
      const familyIds = Array.from(new Set(picked.map((p) => (p as unknown as { family_id?: string }).family_id).filter(Boolean))) as string[];
      const [direct, fam, imgs] = await Promise.all([
        supabase.from("pdr_suppliers").select("id, nom, email, contact_email, tel, contact_phone").in("pdr_id", pickedIds),
        familyIds.length
          ? supabase.from("pdr_family_suppliers").select("id, nom, email, tel").in("family_id", familyIds)
          : Promise.resolve({ data: [] as unknown[] }),
        supabase.from("entity_images").select("id, entity_id, image_url, file_name").eq("entity_type", "pdr").in("entity_id", pickedIds),
      ]);
      if (cancelled) return;
      const list: SupplierRow[] = [];
      const seen = new Set<string>();
      for (const r of ((direct.data ?? []) as any[])) {
        const email = r.email || r.contact_email || null;
        const key = `${r.nom}|${email ?? ""}`;
        if (seen.has(key)) continue;
        seen.add(key);
        list.push({ id: r.id, nom: r.nom, email, tel: r.tel || r.contact_phone || null, source: "pdr" });
      }
      for (const r of ((fam.data ?? []) as any[])) {
        const key = `${r.nom}|${r.email ?? ""}`;
        if (seen.has(key)) continue;
        seen.add(key);
        list.push({ id: r.id, nom: r.nom, email: r.email ?? null, tel: r.tel ?? null, source: "famille" });
      }
      setSuppliers(list);
      setPhotos(((imgs.data ?? []) as PhotoRow[]));
    })();
    return () => { cancelled = true; };
  }, [idsKey]);

  const togglePdr = (p: PdrRow) =>
    setPicked((prev) => prev.some((x) => x.id === p.id) ? prev.filter((x) => x.id !== p.id) : [...prev, p]);

  const buildDraft = (): QuoteDraft => {
    const emails = suppliers.filter((s) => pickedSuppliers.includes(s.id) && s.email).map((s) => s.email!);
    const ref = picked.length === 1 ? picked[0].reference : `${picked.length} références`;
    const subject = `Demande de devis - ${ref} - ${new Date().toLocaleDateString("fr-FR")}`;

    const cols: { key: FieldKey; label: string }[] = [
      { key: "code", label: "Code" },
      { key: "designation", label: "Désignation" },
      { key: "caracteristiques", label: "Caractéristiques" },
      { key: "quantite", label: "Quantité" },
      { key: "conditionnement", label: "Conditionnement" },
    ].filter((c) => fields[c.key as FieldKey]) as { key: FieldKey; label: string }[];

    const head = cols.map((c) => `<th style="text-align:left;border:1px solid #ddd;padding:6px;background:#f5f5f5">${c.label}</th>`).join("");
    const rows = picked.map((p) => {
      const cell = (k: FieldKey) => {
        if (k === "code") return esc(p.reference ?? "");
        if (k === "designation") return esc(p.designation ?? "");
        if (k === "caracteristiques") return esc(caracteristiques(p) || "-");
        if (k === "quantite") return `${esc(qty[p.id] ?? "")} ${esc(p.unite_stock ?? "")}`.trim() || "-";
        if (k === "conditionnement") return esc(packaging || "-");
        return "";
      };
      return `<tr>${cols.map((c) => `<td style="border:1px solid #ddd;padding:6px">${cell(c.key)}</td>`).join("")}</tr>`;
    }).join("");

    const selectedPhotos = fields.photos ? photos.filter((ph) => pickedPhotos.includes(ph.id)) : [];

    const body = [
      "<p>Bonjour,</p>",
      "<p>Nous souhaitons recevoir votre devis pour les produits suivants :</p>",
      `<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`,
      fields.date_livraison && deliveryDate
        ? `<p><strong>Date de livraison souhaitée :</strong> ${esc(new Date(deliveryDate).toLocaleDateString("fr-FR"))}</p>` : "",
      fields.conditionnement && packaging ? `<p><strong>Conditionnement :</strong> ${esc(packaging)}</p>` : "",
      fields.commentaires && comments ? `<p><strong>Commentaires :</strong><br/>${esc(comments).replace(/\n/g, "<br/>")}</p>` : "",
      selectedPhotos.length ? `<p><strong>Photos jointes :</strong> ${selectedPhotos.length}</p>` : "",
      "<p>Merci de nous transmettre vos prix, délais et conditions de livraison.</p>",
      "<p>Cordialement,</p>",
    ].filter(Boolean).join("\n");

    return {
      to: emails.join("; "),
      subject,
      body,
      attachments: selectedPhotos.map((ph, i) => ({
        filename: ph.file_name || `photo-${i + 1}.jpg`,
        url: ph.image_url,
      })),
    };
  };

  const canGenerate = picked.length > 0 && pickedSuppliers.some((id) => suppliers.find((s) => s.id === id)?.email);

  return (
    <div className="space-y-4">
      {/* Étape 1 — PDR */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Package className="h-4 w-4 text-primary" />1. Sélection des PDR</CardTitle>
          <CardDescription>Filtrez par machine et/ou famille, ou recherchez par référence / désignation.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Machine</Label>
              <Select value={machineId} onValueChange={setMachineId}>
                <SelectTrigger className="h-11"><SelectValue placeholder="Toutes les machines" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les machines</SelectItem>
                  {machines.map((m) => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Famille PDR</Label>
              <Select value={familyId} onValueChange={setFamilyId}>
                <SelectTrigger className="h-11"><SelectValue placeholder="Toutes les familles" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les familles</SelectItem>
                  {families.map((f) => <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un PDR…" className="h-11 pl-9" />
            {searching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
          </div>
          {(machineId !== "all" || familyId !== "all") && (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="text-[11px]">{results.length} PDR trouvé(s)</Badge>
              <Button variant="outline" size="sm" className="h-8" onClick={() => setPicked((prev) => {
                const map = new Map(prev.map((p) => [p.id, p]));
                results.forEach((r) => map.set(r.id, r));
                return Array.from(map.values());
              })} disabled={results.length === 0}>
                Tout sélectionner
              </Button>
              <Button variant="ghost" size="sm" className="h-8" onClick={() => { setMachineId("all"); setFamilyId("all"); }}>
                Réinitialiser les filtres
              </Button>
            </div>
          )}
          {results.length > 0 && (
            <div className="max-h-56 divide-y overflow-y-auto rounded-md border">
              {results.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => togglePdr(r)}
                  className="flex w-full items-center gap-2 p-2.5 text-left hover:bg-muted/60"
                >
                  <Checkbox checked={pickedIds.includes(r.id)} className="pointer-events-none" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{r.reference}</span>
                    <span className="block truncate text-xs text-muted-foreground">{r.designation}</span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {picked.length > 0 && (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-2 text-left">Code</th>
                    <th className="p-2 text-left">Désignation</th>
                    {fields.quantite && <th className="p-2 text-left">Quantité</th>}
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {picked.map((p) => (
                    <tr key={p.id}>
                      <td className="p-2 font-mono text-xs">{p.reference}</td>
                      <td className="p-2">{p.designation}</td>
                      {fields.quantite && (
                        <td className="p-2">
                          <Input
                            value={qty[p.id] ?? ""}
                            onChange={(e) => setQty((prev) => ({ ...prev, [p.id]: e.target.value }))}
                            placeholder={p.unite_stock ?? "qté"}
                            className="h-9 w-24"
                            inputMode="decimal"
                          />
                        </td>
                      )}
                      <td className="p-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => togglePdr(p)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Étape 2 — Fournisseurs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Truck className="h-4 w-4 text-primary" />2. Sélection des fournisseurs</CardTitle>
          <CardDescription>Issus du paramétrage des PDR et de leurs familles.</CardDescription>
        </CardHeader>
        <CardContent>
          {picked.length === 0 && <p className="text-sm text-muted-foreground">Sélectionnez d'abord un PDR.</p>}
          {picked.length > 0 && suppliers.length === 0 && (
            <p className="text-sm text-muted-foreground">Aucun fournisseur paramétré pour ces PDR.</p>
          )}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {suppliers.map((s) => (
              <label key={s.id} className="flex cursor-pointer items-start gap-2 rounded-md border p-2.5 hover:bg-muted/50">
                <Checkbox
                  checked={pickedSuppliers.includes(s.id)}
                  disabled={!s.email}
                  onCheckedChange={(v) =>
                    setPickedSuppliers((prev) => v ? [...prev, s.id] : prev.filter((x) => x !== s.id))}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{s.nom}</span>
                    <Badge variant="secondary" className="text-[10px]">{s.source === "pdr" ? "PDR" : "Famille"}</Badge>
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {s.email ?? "Email manquant"}{s.tel ? ` · ${s.tel}` : ""}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Étape 3 — Champs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">3. Champs à inclure</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {FIELDS.map((f) => (
              <label key={f.key} className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={fields[f.key]}
                  onCheckedChange={(v) => setFields((prev) => ({ ...prev, [f.key]: !!v }))}
                />
                {f.label}
              </label>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {fields.date_livraison && (
              <div className="space-y-1.5">
                <Label>Date de livraison souhaitée</Label>
                <Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className="h-11" />
              </div>
            )}
            {fields.conditionnement && (
              <div className="space-y-1.5">
                <Label>Conditionnement</Label>
                <Input value={packaging} onChange={(e) => setPackaging(e.target.value)} placeholder="Carton, palette…" className="h-11" />
              </div>
            )}
          </div>
          {fields.commentaires && (
            <div className="space-y-1.5">
              <Label>Commentaires libres</Label>
              <Textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={3} />
            </div>
          )}
          {fields.photos && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><ImageIcon className="h-4 w-4" />Photos à joindre</Label>
              {photos.length === 0
                ? <p className="text-sm text-muted-foreground">Aucune photo disponible pour ces PDR.</p>
                : (
                  <div className="flex flex-wrap gap-2">
                    {photos.map((ph) => {
                      const on = pickedPhotos.includes(ph.id);
                      return (
                        <button
                          key={ph.id}
                          type="button"
                          onClick={() => setPickedPhotos((prev) => on ? prev.filter((x) => x !== ph.id) : [...prev, ph.id])}
                          className={`relative h-20 w-20 overflow-hidden rounded-md border-2 ${on ? "border-primary" : "border-border"}`}
                        >
                          <img src={ph.image_url} alt={ph.file_name ?? "Photo PDR"} className="h-full w-full object-cover" loading="lazy" />
                          {on && <span className="absolute inset-x-0 bottom-0 bg-primary/80 py-0.5 text-center text-[10px] text-primary-foreground">Joint</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button className="h-11 gap-2" disabled={!canGenerate} onClick={() => onDraft(buildDraft())}>
          <Wand2 className="h-4 w-4" /> Générer le brouillon
        </Button>
        {!canGenerate && (
          <p className="text-xs text-muted-foreground">
            Sélectionnez au moins un PDR et un fournisseur disposant d'une adresse email.
          </p>
        )}
      </div>
    </div>
  );
}
