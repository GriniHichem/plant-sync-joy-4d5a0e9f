import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Shield, Trash2, Users, Camera, Pencil, UserPlus, KeyRound, Globe, GlobeLock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Constants } from "@/integrations/supabase/types";
import { EntityThumbnail } from "@/components/images/EntityThumbnail";
import { useEntityImages } from "@/hooks/useEntityImages";
import { EntityImageUploader } from "@/components/images/EntityImageUploader";
import { useAllRoles } from "@/hooks/useAllRoles";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrateur",
  resp_maintenance: "Resp. Maintenance",
  maintenancier: "Maintenancier",
  resp_production: "Resp. Production",
  chef_ligne: "Chef de ligne",
  operateur: "Opérateur",
  gestionnaire_magasin: "Gest. Magasin",
  responsable_magasin: "Resp. Magasin",
  bureau_methode: "Bureau Méthode",
  responsable_si: "Responsable SI",
  auditeur: "Auditeur",
  controleur_qualite: "Contrôleur Qualité",
  responsable_controle_qualite: "Resp. Contrôle Qualité",
  directeur_qualite: "Directeur Qualité",
  responsable_inventaire: "Resp. Inventaire",
  agent_inventaire: "Agent Inventaire",
  agreeur: "Agréeur",
  agent_pont_bascule: "Agent Pont Bascule",
};

export default function UsersAdmin() {
  const navigate = useNavigate();
  const { hasRole, user } = useAuth();
  const { toast } = useToast();
  const { roles: allRolesEntries } = useAllRoles();
  const roleOptions = allRolesEntries.map((r) => r.code);
  const dynLabels: Record<string, string> = Object.fromEntries(
    allRolesEntries.map((r) => [r.code, r.label]),
  );
  const getRoleLabel = (code: string) => dynLabels[code] ?? ROLE_LABELS[code] ?? code;
  const [profiles, setProfiles] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [entityImages, setEntityImages] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  // Role dialog
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [selUserId, setSelUserId] = useState("");
  const [selRole, setSelRole] = useState("");

  // Photo dialog
  const [photoUserId, setPhotoUserId] = useState<string | null>(null);
  const userImages = useEntityImages("user", photoUserId || undefined);

  // Edit profile dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editProfile, setEditProfile] = useState<any>(null);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editPoste, setEditPoste] = useState("");

  // Create user dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newPoste, setNewPoste] = useState("");
  const [newRole, setNewRole] = useState("");
  const [creating, setCreating] = useState(false);

  // Delete user dialog
  const [deleteProfile, setDeleteProfile] = useState<any>(null);
  const [confirmName, setConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Emails (read-only) + password reset
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [pwdProfile, setPwdProfile] = useState<any>(null);
  const [newPwd, setNewPwd] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);

  const loadEmails = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("admin-user-ops", {
        body: { action: "list_emails" },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setEmails((data as any)?.emails || {});
    } catch {
      /* silently ignore — emails are best-effort */
    }
  };

  const handleResetPassword = async () => {
    if (!pwdProfile || newPwd.length < 6) return;
    setSavingPwd(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-user-ops", {
        body: { action: "set_password", user_id: pwdProfile.user_id, password: newPwd },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: "Mot de passe réinitialisé", description: `${pwdProfile.first_name} ${pwdProfile.last_name} peut se connecter avec le nouveau mot de passe.` });
      setPwdProfile(null);
      setNewPwd("");
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setSavingPwd(false);
    }
  };

  const load = async () => {
    const [pRes, rRes, imgRes] = await Promise.all([
      supabase.from("profiles").select("*").order("last_name"),
      supabase.from("user_roles").select("*"),
      supabase.from("entity_images").select("*").eq("entity_type", "user").eq("is_primary", true),
    ]);
    setProfiles(pRes.data || []);
    setRoles(rRes.data || []);
    setEntityImages(imgRes.data || []);
  };

  useEffect(() => { load(); loadEmails(); }, []);

  useEffect(() => {
    if (!photoUserId) load();
  }, [photoUserId]);

  const getUserRoles = (userId: string) => roles.filter((r) => r.user_id === userId);

  const handleAddRole = async () => {
    if (!selUserId || !selRole) return;
    const existing = roles.find((r) => r.user_id === selUserId && r.role === selRole);
    if (existing) {
      toast({ title: "Rôle déjà attribué", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("user_roles").insert({ user_id: selUserId, role: selRole as any });
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Rôle ajouté" });
      setRoleDialogOpen(false);
      setSelUserId("");
      setSelRole("");
      load();
    }
  };

  const handleRemoveRole = async (roleId: string) => {
    const { error } = await supabase.from("user_roles").delete().eq("id", roleId);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Rôle retiré" });
      load();
    }
  };

  const openEditDialog = (profile: any) => {
    setEditProfile(profile);
    setEditFirstName(profile.first_name || "");
    setEditLastName(profile.last_name || "");
    setEditPoste(profile.poste || "");
    setEditDialogOpen(true);
  };

  const handleUpdateProfile = async () => {
    if (!editProfile) return;
    const { error } = await supabase.from("profiles").update({
      first_name: editFirstName,
      last_name: editLastName,
      poste: editPoste,
    }).eq("user_id", editProfile.user_id);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Profil mis à jour" });
      setEditDialogOpen(false);
      setEditProfile(null);
      load();
    }
  };

  const togglePublicAccess = async (profile: any) => {
    const next = !profile.public_access;
    const { error } = await supabase.from("profiles").update({ public_access: next }).eq("user_id", profile.user_id);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: next ? "Accès Internet autorisé" : "Accès Internet bloqué", description: `${profile.first_name} ${profile.last_name}` });
    load();
  };

  const handleCreateUser = async () => {
    if (!newEmail || !newPassword || !newFirstName || !newLastName) {
      toast({ title: "Veuillez remplir tous les champs obligatoires", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: {
          email: newEmail,
          password: newPassword,
          first_name: newFirstName,
          last_name: newLastName,
          poste: newPoste || null,
          role: newRole || null,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({
        title: "Utilisateur créé",
        description: (data as any)?.warning ?? `${newEmail} est actif et prêt à se connecter.`,
      });
      setCreateDialogOpen(false);
      setNewEmail(""); setNewPassword(""); setNewFirstName("");
      setNewLastName(""); setNewPoste(""); setNewRole("");
      load();
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const deleteFullName = deleteProfile
    ? `${deleteProfile.first_name || ""} ${deleteProfile.last_name || ""}`.trim()
    : "";
  const canConfirmDelete = confirmName.trim() === deleteFullName && deleteFullName.length > 0;

  const handleDeleteUser = async () => {
    if (!deleteProfile || !canConfirmDelete) return;
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-delete-user", {
        body: { user_id: deleteProfile.user_id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: "Utilisateur supprimé", description: `${deleteFullName} a été supprimé définitivement.` });
      setDeleteProfile(null);
      setConfirmName("");
      load();
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };



  const filtered = profiles.filter((p) =>
    `${p.first_name} ${p.last_name} ${p.poste}`.toLowerCase().includes(search.toLowerCase())
  );

  if (!hasRole("admin")) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <Shield className="h-12 w-12 mx-auto mb-4 opacity-30" />
        <p>Accès réservé aux administrateurs</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/parametres")} className="h-10 w-10">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Utilisateurs & Rôles</h1>
          <p className="text-muted-foreground">{profiles.length} utilisateur(s)</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="h-12 px-6"><UserPlus className="h-4 w-4 mr-2" /> Créer un utilisateur</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Créer un utilisateur</DialogTitle>
                <DialogDescription>Le nouvel utilisateur recevra un email de confirmation.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Prénom *</Label>
                    <Input value={newFirstName} onChange={(e) => setNewFirstName(e.target.value)} className="h-12" />
                  </div>
                  <div className="space-y-2">
                    <Label>Nom *</Label>
                    <Input value={newLastName} onChange={(e) => setNewLastName(e.target.value)} className="h-12" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="h-12" placeholder="nom@entreprise.com" />
                </div>
                <div className="space-y-2">
                  <Label>Mot de passe *</Label>
                  <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="h-12" minLength={6} placeholder="Min. 6 caractères" />
                </div>
                <div className="space-y-2">
                  <Label>Poste</Label>
                  <Input value={newPoste} onChange={(e) => setNewPoste(e.target.value)} className="h-12" placeholder="Ex: Technicien maintenance" />
                </div>
                <div className="space-y-2">
                  <Label>Rôle initial</Label>
                  <Select value={newRole} onValueChange={setNewRole}>
                    <SelectTrigger className="h-12"><SelectValue placeholder="Aucun (à attribuer plus tard)" /></SelectTrigger>
                    <SelectContent>
                      {roleOptions.map((r) => (
                        <SelectItem key={r} value={r}>{getRoleLabel(r)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleCreateUser} disabled={creating} className="w-full h-12">
                  {creating ? "Création..." : "Créer l'utilisateur"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="h-12 px-6"><Plus className="h-4 w-4 mr-2" /> Attribuer un rôle</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Attribuer un rôle</DialogTitle>
                <DialogDescription>Sélectionnez un utilisateur et le rôle à attribuer.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Utilisateur *</Label>
                  <Select value={selUserId} onValueChange={setSelUserId}>
                    <SelectTrigger className="h-12"><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                    <SelectContent>
                      {profiles.map((p) => (
                        <SelectItem key={p.user_id} value={p.user_id}>{p.first_name} {p.last_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Rôle *</Label>
                  <Select value={selRole} onValueChange={setSelRole}>
                    <SelectTrigger className="h-12"><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                    <SelectContent>
                      {roleOptions.map((r) => (
                        <SelectItem key={r} value={r}>{getRoleLabel(r)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAddRole} className="w-full h-12">Attribuer</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Input placeholder="Rechercher un utilisateur…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-12 max-w-md" />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Poste</TableHead>
                <TableHead>Rôles</TableHead>
                <TableHead className="w-24 text-center">Internet</TableHead>
                <TableHead className="w-28">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground"><Users className="h-8 w-8 mx-auto mb-2 opacity-30" />Aucun utilisateur</TableCell></TableRow>
              ) : filtered.map((p) => {
                const userRoles = getUserRoles(p.user_id);
                const img = entityImages.find((i: any) => i.entity_id === p.user_id);
                return (
                  <TableRow key={p.id}>
                    <TableCell className="w-10 pr-0">
                      <button onClick={() => setPhotoUserId(p.user_id)} className="relative group">
                        <EntityThumbnail imageUrl={img?.image_url} alt={`${p.first_name} ${p.last_name}`} size="sm" rounded="full" />
                        <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <Camera className="h-3 w-3 text-white" />
                        </div>
                      </button>
                    </TableCell>
                    <TableCell className="font-medium">{p.first_name} {p.last_name}</TableCell>
                    <TableCell className="text-muted-foreground">{emails[p.user_id] || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{p.poste || "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {userRoles.length === 0 && <span className="text-xs text-muted-foreground">Aucun rôle</span>}
                        {userRoles.map((r: any) => (
                          <Badge key={r.id} variant="secondary" className="gap-1 pr-1">
                            {getRoleLabel(r.role)}
                            <button onClick={() => handleRemoveRole(r.id)} className="ml-1 hover:text-destructive">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => togglePublicAccess(p)}
                        title={p.public_access ? "Autorisé via Internet — cliquer pour révoquer" : "Bloqué via Internet — cliquer pour autoriser"}
                        className={p.public_access ? "text-emerald-600 hover:text-emerald-700" : "text-muted-foreground hover:text-foreground"}
                      >
                        {p.public_access ? <Globe className="h-4 w-4" /> : <GlobeLock className="h-4 w-4" />}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(p)} title="Modifier le profil">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => { setPwdProfile(p); setNewPwd(""); }} title="Réinitialiser le mot de passe">
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => { setDeleteProfile(p); setConfirmName(""); }}
                          disabled={p.user_id === user?.id}
                          title={p.user_id === user?.id ? "Vous ne pouvez pas vous supprimer" : "Supprimer l'utilisateur"}
                          className="text-destructive hover:text-destructive disabled:opacity-30"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>

                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit profile dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le profil</DialogTitle>
            <DialogDescription>Modifiez les informations de l'utilisateur.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Prénom</Label>
                <Input value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)} className="h-12" />
              </div>
              <div className="space-y-2">
                <Label>Nom</Label>
                <Input value={editLastName} onChange={(e) => setEditLastName(e.target.value)} className="h-12" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Poste</Label>
              <Input value={editPoste} onChange={(e) => setEditPoste(e.target.value)} className="h-12" placeholder="Ex: Technicien maintenance" />
            </div>
            <Button onClick={handleUpdateProfile} className="w-full h-12">Enregistrer</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Photo upload dialog */}
      <Dialog open={!!photoUserId} onOpenChange={(open) => { if (!open) setPhotoUserId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Photo de profil</DialogTitle>
            <DialogDescription>Ajoutez ou modifiez la photo de profil.</DialogDescription>
          </DialogHeader>
          {photoUserId && (
            <EntityImageUploader
              images={userImages.images}
              primaryImage={userImages.primaryImage}
              uploading={userImages.uploading}
              onUpload={userImages.uploadImage}
              onDelete={userImages.deleteImage}
              onSetPrimary={userImages.setPrimary}
              canEdit={true}
              maxImages={1}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete user confirmation dialog */}
      <Dialog open={!!deleteProfile} onOpenChange={(open) => { if (!open) { setDeleteProfile(null); setConfirmName(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Supprimer l'utilisateur</DialogTitle>
            <DialogDescription>
              Cette action est <strong>irréversible</strong>. Le compte, le profil, les rôles et les photos de{" "}
              <strong>{deleteFullName}</strong> seront définitivement supprimés.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>
                Pour confirmer, saisissez le nom complet : <strong>{deleteFullName}</strong>
              </Label>
              <Input
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                className="h-12"
                placeholder={deleteFullName}
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 h-12"
                onClick={() => { setDeleteProfile(null); setConfirmName(""); }}
                disabled={deleting}
              >
                Annuler
              </Button>
              <Button
                variant="destructive"
                className="flex-1 h-12"
                onClick={handleDeleteUser}
                disabled={!canConfirmDelete || deleting}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {deleting ? "Suppression..." : "Supprimer définitivement"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset password dialog */}
      <Dialog open={!!pwdProfile} onOpenChange={(open) => { if (!open) { setPwdProfile(null); setNewPwd(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Réinitialiser le mot de passe</DialogTitle>
            <DialogDescription>
              Définissez un nouveau mot de passe pour <strong>{pwdProfile?.first_name} {pwdProfile?.last_name}</strong>
              {pwdProfile && emails[pwdProfile.user_id] ? ` (${emails[pwdProfile.user_id]})` : ""}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nouveau mot de passe *</Label>
              <Input
                type="text"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                className="h-12"
                minLength={6}
                placeholder="Min. 6 caractères"
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 h-12" onClick={() => { setPwdProfile(null); setNewPwd(""); }} disabled={savingPwd}>
                Annuler
              </Button>
              <Button className="flex-1 h-12" onClick={handleResetPassword} disabled={newPwd.length < 6 || savingPwd}>
                <KeyRound className="h-4 w-4 mr-2" />
                {savingPwd ? "Enregistrement..." : "Définir le mot de passe"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>


  );
}
