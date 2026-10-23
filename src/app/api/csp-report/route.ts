// Reçoit les rapports de violation de la Content Security Policy (envoyés par le navigateur, sans session).
// On journalise un résumé pour repérer ce qu'une CSP trop stricte casse ou une tentative d'injection.
// Entrée non fiable : taille limitée, rien n'est stocké, seuls des champs courts sont recopiés dans les logs.

const MAX_BYTES = 8 * 1024;
const short = (v: unknown) => (typeof v === "string" ? v.replace(/[\r\n]+/g, " ").slice(0, 200) : undefined);

export async function POST(request: Request) {
  const text = await request.text();
  if (text.length > MAX_BYTES) return new Response(null, { status: 413 });
  try {
    const data = JSON.parse(text) as Record<string, unknown>;
    // Ancien format : { "csp-report": {...} } ; nouveau (Reporting API) : tableau d'objets { body: {...} }.
    const reports = Array.isArray(data) ? data.map((r) => (r as { body?: Record<string, unknown> }).body) : [data["csp-report"] as Record<string, unknown>];
    for (const r of reports.slice(0, 5)) {
      if (!r) continue;
      console.warn("[CSP]", {
        directive: short(r["violated-directive"] ?? r["effectiveDirective"]),
        blocked: short(r["blocked-uri"] ?? r["blockedURL"]),
        page: short(r["document-uri"] ?? r["documentURL"]),
        source: short(r["source-file"] ?? r["sourceFile"]),
      });
    }
  } catch {
    // Rapport illisible : ignoré.
  }
  return new Response(null, { status: 204 });
}
