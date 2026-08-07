import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useImageMaxSize } from "@/hooks/useImageMaxSize";

export interface EntityImage {
  id: string;
  entity_type: string;
  entity_id: string;
  image_url: string;
  storage_path: string;
  is_primary: boolean;
  sort_order: number;
  file_name: string;
  file_size: number;
  created_at: string;
  uploaded_by: string | null;
}

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_DIMENSION = 1920;
const QUALITY = 0.82;

const ENTITY_LABELS: Record<string, string> = {
  machine: "les machines",
  pdr: "les PDR",
  equipement: "les équipements",
  produit: "les produits",
  article: "les articles",
  user: "les utilisateurs",
};

async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Compression failed"))),
        "image/jpeg",
        QUALITY
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image load failed")); };
    img.src = url;
  });
}

export function useEntityImages(entityType: string, entityId: string | undefined) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { maxSizeBytes, maxSizeMb } = useImageMaxSize(entityType);
  const [images, setImages] = useState<EntityImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    if (!entityId) { setImages([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from("entity_images")
      .select("*")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("is_primary", { ascending: false })
      .order("sort_order");
    setImages((data as EntityImage[]) || []);
    setLoading(false);
  }, [entityType, entityId]);

  useEffect(() => { load(); }, [load]);

  const primaryImage = images.find((i) => i.is_primary) || images[0] || null;
  const secondaryImages = images.filter((i) => !i.is_primary);

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) return "Format non supporté. Utilisez JPG, PNG, WebP ou GIF.";
    if (file.size > maxSizeBytes) {
      const label = ENTITY_LABELS[entityType] || entityType;
      return `Fichier trop volumineux (max ${maxSizeMb} Mo pour ${label}).`;
    }
    return null;
  };

  const uploadImage = async (file: File, isPrimary = false): Promise<EntityImage | null> => {
    if (!entityId || !user) return null;
    const error = validateFile(file);
    if (error) { toast({ title: "Erreur", description: error, variant: "destructive" }); return null; }

    setUploading(true);
    try {
      const compressed = await compressImage(file);
      const ext = "jpg";
      const path = `${entityType}/${entityId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error: upErr } = await supabase.storage.from("entity-images").upload(path, compressed, {
        contentType: "image/jpeg",
        upsert: false,
      });
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage.from("entity-images").getPublicUrl(path);

      if (isPrimary) {
        await supabase
          .from("entity_images")
          .update({ is_primary: false } as any)
          .eq("entity_type", entityType)
          .eq("entity_id", entityId)
          .eq("is_primary", true);
      }

      const { data: row, error: insErr } = await supabase
        .from("entity_images")
        .insert({
          entity_type: entityType,
          entity_id: entityId,
          image_url: urlData.publicUrl,
          storage_path: path,
          is_primary: isPrimary || images.length === 0,
          sort_order: images.length,
          file_name: file.name,
          file_size: compressed.size,
          uploaded_by: user.id,
        } as any)
        .select()
        .single();

      if (insErr) throw insErr;

      await load();
      toast({ title: "Image ajoutée" });
      return row as EntityImage;
    } catch (err: any) {
      toast({ title: "Erreur upload", description: err.message, variant: "destructive" });
      return null;
    } finally {
      setUploading(false);
    }
  };

  const deleteImage = async (image: EntityImage) => {
    await supabase.storage.from("entity-images").remove([image.storage_path]);
    await supabase.from("entity_images").delete().eq("id", image.id);

    if (image.is_primary) {
      const remaining = images.filter((i) => i.id !== image.id);
      if (remaining.length > 0) {
        await supabase.from("entity_images").update({ is_primary: true } as any).eq("id", remaining[0].id);
      }
    }

    await load();
    toast({ title: "Image supprimée" });
  };

  const setPrimary = async (image: EntityImage) => {
    if (!entityId) return;
    await supabase
      .from("entity_images")
      .update({ is_primary: false } as any)
      .eq("entity_type", entityType)
      .eq("entity_id", entityId);
    await supabase
      .from("entity_images")
      .update({ is_primary: true } as any)
      .eq("id", image.id);
    await load();
    toast({ title: "Image principale définie" });
  };

  return {
    images,
    primaryImage,
    secondaryImages,
    loading,
    uploading,
    uploadImage,
    deleteImage,
    setPrimary,
    reload: load,
    maxSizeMb,
  };
}
