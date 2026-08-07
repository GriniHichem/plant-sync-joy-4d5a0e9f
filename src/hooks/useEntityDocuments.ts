import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

export function useEntityDocuments(entityType: string, entityId?: string) {
  const [documents, setDocuments] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchDocuments = useCallback(async () => {
    if (!entityId) return;
    const { data } = await supabase
      .from("entity_documents")
      .select("*, document_categories(name)")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("created_at", { ascending: false });
    setDocuments(data || []);
    setLoading(false);
  }, [entityType, entityId]);

  const fetchCategories = useCallback(async () => {
    const { data } = await supabase
      .from("document_categories")
      .select("*")
      .eq("is_active", true)
      .order("sort_order");
    setCategories(data || []);
  }, []);

  useEffect(() => {
    fetchDocuments();
    fetchCategories();
  }, [fetchDocuments, fetchCategories]);

  const uploadDocument = async (file: File, categoryId: string, description: string) => {
    if (!entityId || !user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${entityType}/${entityId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("entity-documents")
        .upload(path, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("entity-documents")
        .getPublicUrl(path);

      const { error: insertError } = await supabase
        .from("entity_documents")
        .insert({
          entity_type: entityType,
          entity_id: entityId,
          category_id: categoryId,
          file_name: file.name,
          file_url: urlData.publicUrl,
          storage_path: path,
          file_size: file.size,
          file_type: file.type || ext || "",
          description: description || null,
          uploaded_by: user.id,
        } as any);
      if (insertError) throw insertError;

      toast({ title: "Document ajouté" });
      await fetchDocuments();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const deleteDocument = async (doc: any) => {
    await supabase.storage.from("entity-documents").remove([doc.storage_path]);
    await supabase.from("entity_documents").delete().eq("id", doc.id);
    toast({ title: "Document supprimé" });
    await fetchDocuments();
  };

  return { documents, categories, loading, uploading, uploadDocument, deleteDocument, refetch: fetchDocuments };
}
