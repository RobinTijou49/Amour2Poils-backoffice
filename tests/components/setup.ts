import { afterEach, mock } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

// Préchargé avant les tests de composants (bun run test:components) : un faux navigateur (happy-dom) fournit `document`,
// `window`, `navigator`… à React et à Testing Library. Séparé des autres suites car il remplace aussi `fetch`, `Request`
// et `Response`, dont les tests d'API ont besoin dans leur version d'origine.
mock.module("server-only", () => ({}));
GlobalRegistrator.register({ url: "http://localhost:3000" });

// Dit à React 19 qu'on est dans un environnement de test (évite l'avertissement « not wrapped in act »).
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Import APRÈS l'enregistrement : Testing Library lit `document.body` au chargement du module (il serait indéfini avant).
const { cleanup } = await import("@testing-library/react");

// Retire du document ce que le test a affiché : sans cela, les composants d'un test restent visibles dans le suivant.
afterEach(() => cleanup());
