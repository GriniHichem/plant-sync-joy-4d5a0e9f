import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

/**
 * Règles et paramètres de shift — shift_settings.
 * Lues par l'écran shift production (ex : règle Heure -1).
 */
export function RulesTab() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<any[]>([]);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from("shift_settings").select("*").order("key");
    setSettings(data || []);
  }

  async function handleUpdate(id: string, value: string) {
    await supabase.from("shift_settings").update({ value }).eq("id", id);
    toast({ title: "Paramètre mis à jour" });
    load();
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Règles et paramètres</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {settings.map((s) => (
          <div key={s.id} className="flex items-center justify-between gap-4 p-4 border rounded-lg">
            <div className="flex-1">
              <p className="font-medium text-sm">{s.label}</p>
              {s.description && <p className="text-xs text-muted-foreground">{s.description}</p>}
            </div>
            <Input
              value={s.value}
              onChange={(e) => setSettings((prev) => prev.map((p) => p.id === s.id ? { ...p, value: e.target.value } : p))}
              onBlur={() => handleUpdate(s.id, s.value)}
              className="w-24 h-9 text-center font-mono"
            />
          </div>
        ))}
        {settings.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">Aucune règle configurée.</p>
        )}
      </CardContent>
    </Card>
  );
}
