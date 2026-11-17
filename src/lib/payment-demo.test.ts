import { describe, expect, test } from "bun:test";
import { centsToDecimal, GOOGLE_PAY_METHOD, paymentDetails } from "./payment-demo";

describe("centsToDecimal : centimes entiers vers « 123.45 » sans passer par un flottant", () => {
  test.each([
    [0, "0.00"],
    [5, "0.05"],
    [10, "0.10"],
    [99, "0.99"],
    [100, "1.00"],
    [8150, "81.50"],
    [123456, "1234.56"],
    [1_000_000_007, "10000000.07"],
  ])("%d centimes → %s", (cents, expected) => {
    expect(centsToDecimal(cents)).toBe(expected);
  });

  test("refuse ce qui n'est pas un entier de centimes positif", () => {
    for (const bad of [-1, 1.5, NaN, Infinity, 2 ** 53]) expect(() => centsToDecimal(bad)).toThrow(RangeError);
  });
});

describe("paymentDetails", () => {
  test("total en euros avec le numéro de la facture dans le libellé", () => {
    expect(paymentDetails(8150, "F-2026-0004")).toEqual({ total: { label: "Facture F-2026-0004", amount: { currency: "EUR", value: "81.50" } } });
  });
});

describe("GOOGLE_PAY_METHOD : mode TEST, jamais de débit", () => {
  test("environnement TEST et passerelle factice « example »", () => {
    const data = GOOGLE_PAY_METHOD.data as { environment: string; allowedPaymentMethods: { tokenizationSpecification: { parameters: { gateway: string } } }[] };
    expect(GOOGLE_PAY_METHOD.supportedMethods).toBe("https://google.com/pay");
    expect(data.environment).toBe("TEST");
    expect(data.allowedPaymentMethods[0]!.tokenizationSpecification.parameters.gateway).toBe("example");
  });
});
