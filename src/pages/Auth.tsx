import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Globe, ShieldAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { isPublicHost } from "@/lib/network";
import logoAsset from "@/assets/brand/prod-in-time-logo.png";
import logoAmour from "@/assets/brand/logo-amour.jpg";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);
  const [publicHost] = useState<boolean>(() => isPublicHost());
  const [gateEnabled, setGateEnabled] = useState<boolean>(false);
  const [blockedPublic, setBlockedPublic] = useState<boolean>(() => {
    try { return sessionStorage.getItem("pit:blockedPublic") === "1"; } catch { return false; }
  });
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (blockedPublic) {
      try { sessionStorage.removeItem("pit:blockedPublic"); } catch { /* ignore */ }
    }
  }, [blockedPublic]);

  useEffect(() => {
    if (!publicHost) return;
    supabase.from("app_settings").select("value").eq("key", "control.enforce_public_access_gate").maybeSingle()
      .then(({ data }) => setGateEnabled(data?.value === "true"));
  }, [publicHost]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        console.log("Attempting login for:", email);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          console.error("Login error details:", { message: error.message, status: error.status });
          throw error;
        }
        console.log("Login successful, navigating to home");
        navigate("/");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { first_name: firstName, last_name: lastName },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast({
          title: "Compte créé",
          description: "Vérifiez votre email pour confirmer votre compte.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-3">
          <div className="flex items-center justify-center">
            <img src={logoAsset} alt="Prod in Time" className="h-48 w-auto object-contain" />
          </div>
          <div className="flex items-center justify-center">
            <img src={logoAmour} alt="Amour" className="h-10 w-auto object-contain rounded" />
          </div>
          <p className="text-xs text-muted-foreground tracking-wide">GMAO & GPAO</p>
          <CardDescription>
            {isLogin ? "Connectez-vous à votre espace" : "Créer un nouveau compte"}
          </CardDescription>
          {/* Public gate UI elements hidden to simplify login process */}
        </CardHeader>
        <CardContent>
          {blockedPublic && (
            <Alert variant="destructive" className="mb-4">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Connexion via Internet non autorisée</AlertTitle>
              <AlertDescription>
                Ce compte n'a pas l'autorisation d'accéder à l'application depuis l'extérieur du réseau de l'usine. Contactez votre administrateur pour activer l'accès public sur votre profil.
              </AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Prénom</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required={!isLogin}
                    className="h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Nom</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required={!isLogin}
                    className="h-12"
                  />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12"
                placeholder="nom@entreprise.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="h-12"
              />
            </div>
            <Button type="submit" className="w-full h-12 text-base" disabled={loading}>
              {loading ? "Chargement..." : isLogin ? "Se connecter" : "Créer le compte"}
            </Button>
          </form>
          <div className="mt-4 text-center space-y-2">
            {isLogin && (
              <button
                type="button"
                onClick={async () => {
                  if (!email) {
                    toast({ title: "Entrez votre email", description: "Saisissez votre adresse email puis cliquez sur 'Mot de passe oublié'", variant: "destructive" });
                    return;
                  }
                  const { error } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: `${window.location.origin}/reset-password`,
                  });
                  if (error) {
                    toast({ title: "Erreur", description: error.message, variant: "destructive" });
                  } else {
                    toast({ title: "Email envoyé", description: "Vérifiez votre boîte mail pour réinitialiser votre mot de passe." });
                  }
                }}
                className="text-sm text-muted-foreground hover:text-primary hover:underline"
              >
                Mot de passe oublié ?
              </button>
            )}
            <div>
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm text-primary hover:underline"
              >
                {isLogin ? "Pas encore de compte ? S'inscrire" : "Déjà un compte ? Se connecter"}
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
