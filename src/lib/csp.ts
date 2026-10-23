// Content Security Policy d'une requête, avec son nonce. Fonction pure (testée dans csp.test.ts) utilisée par src/proxy.ts.
// `dev` : rechargement à chaud de Next ('unsafe-eval'). `local` : serveur HTTP sur localhost.
export function contentSecurityPolicy(nonce: string, { local, dev }: { local: boolean; dev: boolean }) {
  return [
    "default-src 'self'",
    // 'strict-dynamic' : un script de confiance (avec nonce) peut en charger d'autres, ce qui évite d'énumérer les fichiers de Next.
    // 'unsafe-eval' seulement en développement (rechargement à chaud).
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // Un nonce ne couvre pas les attributs style="" (largeurs de barres de progression, etc.) : 'unsafe-inline' reste
    // nécessaire pour les styles. Le risque est bien plus faible que pour les scripts.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    // Les notifications push passent par le navigateur lui-même, pas par fetch : 'self' suffit.
    "connect-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    // Sauf sur localhost : on y sert en HTTP et « upgrade » casserait le chargement des fichiers.
    ...(local ? [] : ["upgrade-insecure-requests"]),
    "report-uri /api/csp-report",
  ].join("; ");
}
