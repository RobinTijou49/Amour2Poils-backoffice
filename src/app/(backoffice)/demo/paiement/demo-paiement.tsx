"use client";

import { browserSupportsWebAuthn, platformAuthenticatorIsAvailable, startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/field";
import { formatEuros } from "@/lib/format";
import { GOOGLE_PAY_METHOD, paymentDetails } from "@/lib/payment-demo";

type PasskeyRow = { id: string; createdAt: string; lastUsedAt: string | null };
type InvoiceRow = { id: string; number: string; owner: string; totalCents: number };
type Intent = { invoiceId: string; number: string; amountCents: number };
type Feedback = { status?: string; error?: string };

// Libellés longs : sur un écran de 320 px ils doivent passer à la ligne au lieu de faire défiler la page (WCAG 1.4.10).
const wrapButton = "w-full whitespace-normal! py-2 text-center sm:w-auto";

type Support = { webauthn: boolean; paymentRequest: boolean };
let cachedSupport: Support | null = null;
// useSyncExternalStore exige un instantané STABLE tant que rien ne change : on ne renvoie un nouvel objet que si une valeur change.
const readSupport = (): Support => {
  const next = { webauthn: browserSupportsWebAuthn(), paymentRequest: "PaymentRequest" in window };
  if (!cachedSupport || cachedSupport.webauthn !== next.webauthn || cachedSupport.paymentRequest !== next.paymentRequest) cachedSupport = next;
  return cachedSupport;
};
const subscribeNever = () => () => {};

async function postJson<T = unknown>(url: string, body: unknown = {}): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, data: data as T } : { ok: false, error: (data as { error?: string }).error ?? "Erreur inattendue." };
  } catch {
    return { ok: false, error: "Le serveur est injoignable." };
  }
}

/** Message lisible pour les refus courants du navigateur (annulation, aucune clé, contexte non sécurisé). */
function deviceError(error: unknown) {
  const name = error instanceof Error ? error.name : "";
  if (name === "NotAllowedError") return "Annulé ou refusé sur l'appareil. Réessayez et validez avec l'empreinte, le visage ou le code.";
  if (name === "InvalidStateError") return "Cet appareil a déjà une passkey enregistrée pour ce compte.";
  if (name === "SecurityError") return "Le navigateur refuse : WebAuthn exige HTTPS (ou localhost).";
  return "L'appareil n'a pas pu créer ou utiliser la passkey.";
}

/** Zone d'annonce PERSISTANTE (toujours dans la page) : un lecteur d'écran n'annonce que les changements d'une zone déjà présente. */
function Messages({ status, error }: Feedback) {
  return (
    <>
      <p role="status" className="min-h-6 text-sm font-semibold text-success-fg">
        {status}
      </p>
      <p role="alert" className="min-h-6 text-sm font-semibold text-danger-fg">
        {error}
      </p>
    </>
  );
}

export function DemoPaiement({ passkeys: initialPasskeys, invoices }: { passkeys: PasskeyRow[]; invoices: InvoiceRow[] }) {
  const [passkeyCount, setPasskeyCount] = useState(initialPasskeys.length);
  const [lastUsed, setLastUsed] = useState(initialPasskeys.map((p) => p.lastUsedAt).find(Boolean) ?? null);
  const [passkeyFeedback, setPasskeyFeedback] = useState<Feedback>({});
  const [busy, setBusy] = useState<"register" | "verify" | "intent" | "pay" | null>(null);
  const [verified, setVerified] = useState(false);
  const [invoiceId, setInvoiceId] = useState(invoices[0]?.id ?? "");
  const [intent, setIntent] = useState<Intent | null>(null);
  const [payFeedback, setPayFeedback] = useState<Feedback>({});
  // Ce que le navigateur sait faire n'est connu que côté client : le serveur rend « null » (« Détection… »), puis le client
  // lit les capacités sans passer par un état mis à jour dans un effet.
  const support = useSyncExternalStore(subscribeNever, readSupport, () => null);
  const [platform, setPlatform] = useState<boolean | null>(null);
  useEffect(() => {
    platformAuthenticatorIsAvailable().then(setPlatform, () => setPlatform(false));
  }, []);

  async function register() {
    setBusy("register");
    setPasskeyFeedback({});
    const options = await postJson<Parameters<typeof startRegistration>[0]["optionsJSON"]>("/api/demo/passkeys/inscription/options");
    if (!options.ok) {
      setBusy(null);
      return setPasskeyFeedback({ error: options.error });
    }
    try {
      // L'appareil demande l'empreinte, le visage ou le code et crée une paire de clés : la clé privée n'en sort jamais.
      const credential = await startRegistration({ optionsJSON: options.data });
      const verification = await postJson("/api/demo/passkeys/inscription/verification", { response: credential });
      if (!verification.ok) setPasskeyFeedback({ error: verification.error });
      else {
        setPasskeyCount((n) => n + 1);
        setPasskeyFeedback({ status: "Passkey enregistrée. Le serveur ne garde que la clé publique." });
      }
    } catch (error) {
      setPasskeyFeedback({ error: deviceError(error) });
    }
    setBusy(null);
  }

  async function verify() {
    setBusy("verify");
    setPasskeyFeedback({});
    setIntent(null);
    const options = await postJson<Parameters<typeof startAuthentication>[0]["optionsJSON"]>("/api/demo/passkeys/authentification/options");
    if (!options.ok) {
      setBusy(null);
      return setPasskeyFeedback({ error: options.error });
    }
    try {
      const assertion = await startAuthentication({ optionsJSON: options.data });
      const verification = await postJson("/api/demo/passkeys/authentification/verification", { response: assertion });
      if (!verification.ok) {
        setVerified(false);
        setPasskeyFeedback({ error: verification.error });
      } else {
        setVerified(true);
        setLastUsed("à l'instant");
        setPasskeyFeedback({ status: "Identité confirmée par l'appareil. Le paiement est autorisé pendant 2 minutes." });
      }
    } catch (error) {
      setVerified(false);
      setPasskeyFeedback({ error: deviceError(error) });
    }
    setBusy(null);
  }

  async function askAmount() {
    setBusy("intent");
    setPayFeedback({});
    const res = await postJson<Intent>("/api/demo/paiement/intention", { invoiceId });
    setBusy(null);
    if (!res.ok) {
      setIntent(null);
      return setPayFeedback({ error: res.error });
    }
    setIntent(res.data);
    setPayFeedback({ status: `Le serveur demande ${formatEuros(res.data.amountCents)} pour la facture ${res.data.number}.` });
  }

  async function pay() {
    if (!intent) return;
    setBusy("pay");
    setPayFeedback({});
    try {
      const request = new PaymentRequest([GOOGLE_PAY_METHOD], paymentDetails(intent.amountCents, intent.number));
      if (!(await request.canMakePayment())) {
        setBusy(null);
        return setPayFeedback({ error: "Aucun portefeuille compatible (Google Pay) n'est disponible sur cet appareil." });
      }
      // La feuille de paiement est dessinée par le NAVIGATEUR : notre page n'y voit ni ne touche rien.
      const response = await request.show();
      const confirmation = await postJson<{ message: string }>("/api/demo/paiement/confirmation", {
        invoiceId: intent.invoiceId,
        amountCents: intent.amountCents,
        token: JSON.stringify(response.details),
      });
      await response.complete(confirmation.ok ? "success" : "fail");
      setPayFeedback(confirmation.ok ? { status: `Jeton reçu et vérifié par le serveur. ${confirmation.data.message}` } : { error: confirmation.error });
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      setPayFeedback({ error: name === "AbortError" || name === "NotAllowedError" ? "Paiement annulé." : "La feuille de paiement n'a pas pu s'ouvrir sur cet appareil." });
    }
    setBusy(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <Card title="Ce que cet appareil sait faire">
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Capacités détectées">
          <Capability label="WebAuthn (passkeys)" value={support === null ? null : support.webauthn} />
          <Capability label="Empreinte, visage ou code de l'appareil" value={support === null || platform === null ? null : support.webauthn && platform} />
          <Capability label="Payment Request API" value={support === null ? null : support.paymentRequest} />
        </dl>
      </Card>

      <Card title="Étape 1 : prouver son identité avec une passkey">
        <p className="text-sm text-foreground-light">
          L&apos;empreinte ou le visage ne quittent jamais l&apos;appareil. Le serveur envoie un défi aléatoire, l&apos;appareil le signe avec une clé privée
          qui reste dedans, et le serveur vérifie la signature avec la clé publique.
        </p>
        <p className="text-sm" aria-live="off">
          Passkeys enregistrées : <strong>{passkeyCount}</strong>
          {lastUsed && <> · dernière vérification : {lastUsed}</>}
        </p>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" icon="plus" onClick={register} disabled={busy !== null || support?.webauthn === false} className={wrapButton}>
            {busy === "register" ? "Création en cours…" : "Enregistrer une passkey"}
          </Button>
          <Button icon="valider" onClick={verify} disabled={busy !== null || passkeyCount === 0 || support?.webauthn === false} className={wrapButton}>
            {busy === "verify" ? "Vérification en cours…" : "Me vérifier (empreinte, visage ou code)"}
          </Button>
        </div>
        <Messages {...passkeyFeedback} />
      </Card>

      <Card title="Étape 2 : payer avec la Payment Request API">
        <p className="text-sm text-foreground-light">
          Le serveur calcule le montant en centimes, le navigateur affiche sa propre feuille de paiement et ne rend qu&apos;un jeton à usage unique : notre
          site ne voit jamais le numéro de carte. Mode TEST de Google Pay : aucun débit.
        </p>
        {invoices.length === 0 ? (
          <p className="text-sm">Aucune facture « envoyée » à payer : envoyez-en une depuis la facturation.</p>
        ) : (
          <>
            <Select label="Facture à payer" name="invoiceId" value={invoiceId} onChange={(e) => { setInvoiceId(e.target.value); setIntent(null); }}>
              {invoices.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.number} · {i.owner} · {formatEuros(i.totalCents)}
                </option>
              ))}
            </Select>
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={askAmount} disabled={busy !== null} className={wrapButton}>
                {busy === "intent" ? "Demande en cours…" : "Demander le montant au serveur"}
              </Button>
              <Button onClick={pay} disabled={busy !== null || !intent || support?.paymentRequest === false} className={wrapButton}>
                {busy === "pay" ? "Paiement en cours…" : intent ? `Payer ${formatEuros(intent.amountCents)} avec le portefeuille` : "Payer avec le portefeuille"}
              </Button>
            </div>
            {!verified && <p className="text-sm text-foreground-light">Sans l&apos;étape 1 (moins de 2 minutes), le serveur refuse de donner le montant.</p>}
          </>
        )}
        <Messages {...payFeedback} />
      </Card>

      <Card title="Ce que le serveur voit, et ne voit jamais">
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>Il voit : une clé publique, un compteur, une signature du défi, un jeton de paiement à usage unique.</li>
          <li>Il ne voit jamais : l&apos;empreinte ou le visage, la clé privée, le numéro de carte.</li>
          <li>Il décide du montant (en centimes) et le revérifie à la confirmation : un montant modifié côté navigateur est refusé.</li>
          <li>La passkey est liée au nom de domaine : sur un faux site, elle ne se déclenche pas (hameçonnage).</li>
        </ul>
      </Card>
    </div>
  );
}

function Capability({ label, value }: { label: string; value: boolean | null }) {
  return (
    <div className="flex flex-col gap-1 rounded-sm border border-border p-3">
      <dt className="text-sm text-foreground-light">{label}</dt>
      <dd className="font-bold">{value === null ? "Détection…" : value ? "Disponible" : "Non disponible"}</dd>
    </div>
  );
}
