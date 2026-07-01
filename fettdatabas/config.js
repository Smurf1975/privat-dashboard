// Fettdatabas — publik konfiguration (säkert att exponera: publishable key skyddas av RLS)
window.FETT_CONFIG = {
  SUPABASE_URL: 'https://ncgxerxkgoxptcwvramn.supabase.co',
  SUPABASE_KEY: 'sb_publishable_lUbpt8cdMSj73xRMr8TI5Q_sHZZRJPs',
  // Vart magic link-mailet skickar användaren tillbaka (måste ligga i Supabase Auth → Redirect URLs)
  REDIRECT_URL: window.location.origin + window.location.pathname,
};
