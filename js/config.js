// Isi dua nilai ini setelah membuat project Supabase ARES.
// Gunakan Project URL dan anon/publishable key. JANGAN pernah memasukkan service_role key ke frontend.
window.ARES_CONFIG = {
  SUPABASE_URL: "https://ujhvkmsxnupvykkhxsuo.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_KJJT5cSXTXnhPfULuEWUAQ_L4S4bBfc",
  // Web Push asli (browser tertutup): isi VAPID public key (lihat supabase/update-push.sql). Kosong = notifikasi hanya saat situs terbuka.
  VAPID_PUBLIC_KEY: ""
};
