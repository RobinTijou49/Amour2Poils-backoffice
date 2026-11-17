// Briques de la démonstration « Payment Request » : sans serveur ni navigateur, donc testables telles quelles.

/**
 * Centimes entiers → texte décimal attendu par la Payment Request API (« 123.45 »). Calcul sur des entiers : les montants
 * ne passent jamais par un flottant (règle du projet), donc pas de 0,1 + 0,2 = 0,30000000000000004.
 */
export function centsToDecimal(cents: number) {
  if (!Number.isSafeInteger(cents) || cents < 0) throw new RangeError("Montant invalide : entier de centimes positif attendu.");
  return `${Math.trunc(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

/** Détails de la commande affichés dans la feuille de paiement du navigateur. */
export function paymentDetails(amountCents: number, invoiceNumber: string): PaymentDetailsInit {
  return { total: { label: `Facture ${invoiceNumber}`, amount: { currency: "EUR", value: centsToDecimal(amountCents) } } };
}

/**
 * Google Pay en mode TEST : la passerelle « example » est la passerelle factice de Google, qui rend un jeton de test et ne
 * débite jamais personne. En production, on remplacerait `gateway` et `gatewayMerchantId` par ceux du prestataire de
 * paiement (Stripe, Adyen…) : c'est lui, et non nous, qui déchiffre le jeton.
 */
export const GOOGLE_PAY_METHOD: PaymentMethodData = {
  supportedMethods: "https://google.com/pay",
  data: {
    environment: "TEST",
    apiVersion: 2,
    apiVersionMinor: 0,
    merchantInfo: { merchantName: "Amour 2 Poils (démonstration)" },
    allowedPaymentMethods: [
      {
        type: "CARD",
        parameters: { allowedAuthMethods: ["PAN_ONLY", "CRYPTOGRAM_3DS"], allowedCardNetworks: ["VISA", "MASTERCARD"] },
        tokenizationSpecification: { type: "PAYMENT_GATEWAY", parameters: { gateway: "example", gatewayMerchantId: "exampleGatewayMerchantId" } },
      },
    ],
  },
};
