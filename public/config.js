// Configuration dynamique pour le déploiement self-hosted
// Ce fichier est chargé au démarrage de l'application via index.html
window.__APP_CONFIG__ = {
  // Les variables ci-dessous peuvent être surchargées par le serveur de déploiement
  // Si vide, l'application utilisera les variables d'environnement par défaut
  VITE_SUPABASE_URL: "",
  VITE_SUPABASE_ANON_KEY: "",
};

console.log("PROD IN TIME: Runtime configuration initialized.");

