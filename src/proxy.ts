import { NextResponse, type NextRequest } from "next/server";

// Redirection optimiste : sans cookie de session, inutile de rendre la page.
// La vraie vérification (session valide en base, rôle) se fait dans src/lib/auth.ts.
export function proxy(request: NextRequest) {
  if (!request.cookies.has("a2p_session")) {
    return NextResponse.redirect(new URL("/connexion", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Tout sauf la connexion, la sonde de santé et les fichiers techniques / statiques.
  matcher: ["/((?!connexion|api/health|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico|webmanifest)$).*)"],
};
