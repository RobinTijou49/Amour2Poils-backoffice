import { prepareDatabase, reseed } from "./reseed";

// Exécuté une fois avant tous les tests, AVANT le démarrage du serveur (webServer) : la base doit exister et être à jour.
export default function globalSetup() {
  prepareDatabase();
  reseed();
}
