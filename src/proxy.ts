import { NextResponse, type NextRequest } from "next/server";

// Le proxy s'exécute avant chaque page. Deux rôles :
//  1. Content Security Policy à nonce : un jeton aléatoire par requête, seuls les scripts qui le portent s'exécutent
//     (un script injecté par une faille XSS n'a pas ce jeton et est bloqué par le navigateur) ;
//  2. redirection « optimiste » : sans cookie de session, inutile de rendre la page. La vraie vérification
//     (session valide en base, rôle) se fait dans src/lib/auth.ts.

// Bascule du mode « rapport seulement » (le navigateur signale les violations sans rien bloquer) au mode bloquant.
const ENFORCE_CSP = false;

// Pages et routes accessibles sans session.
const PUBLIC_PATHS = ["/connexion", "/offline", "/api/health", "/api/push/rappels-vaccins", "/api/csp-report"];

function contentSecurityPolicy(nonce: string, local: boolean) {
  const dev = process.env.NODE_ENV === "development";
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

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!isPublic && !request.cookies.has("a2p_session")) {
    // Une API répond 401 en JSON : une redirection vers la page de connexion n'aurait pas de sens pour un client HTTP.
    if (isApi) return Response.json({ error: "Authentification requise." }, { status: 401 });
    return NextResponse.redirect(new URL("/connexion", request.url));
  }
  if (isApi) return NextResponse.next();

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = contentSecurityPolicy(nonce, ["localhost", "127.0.0.1"].includes(request.nextUrl.hostname));
  // Next lit le nonce dans l'en-tête de la requête et l'ajoute lui-même à ses balises <script>.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(ENFORCE_CSP ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only", csp);
  return response;
}

export const config = {
  // Tout sauf les fichiers statiques et techniques (pas de HTML, donc pas de CSP à y mettre).
  // Les préchargements (next/link) sont ignorés : ils n'exécutent aucun script et le nonce serait gaspillé.
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|sw.js|icons|manifest.webmanifest|.*\\.(?:svg|png|jpg|ico|webmanifest)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
