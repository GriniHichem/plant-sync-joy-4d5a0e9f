// Configuration dynamique pour le déploiement self-hosted
// Ce fichier est chargé au démarrage de l'application via index.html
window.__APP_CONFIG__ = {
  // Les variables ci-dessous peuvent être surchargées par le serveur de déploiement
  VITE_SUPABASE_URL: window.location.origin,
  VITE_SUPABASE_ANON_KEY: "placeholder-key-for-self-hosting",
};

console.log("PROD IN TIME: Runtime configuration loaded.");
