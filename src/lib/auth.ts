import "server-only";
import { forbidden, redirect } from "next/navigation";
import { cache } from "react";
import type { Role } from "@/generated/prisma/client";
import { getSession } from "@/lib/session";

// Data Access Layer : seul point d'entrée pour savoir qui est connecté.
// `cache` (React) évite de relire la session plusieurs fois pendant une même requête.
export const getCurrentUser = cache(async () => {
  const session = await getSession();
  if (!session) redirect("/connexion");
  return session.user;
});

export async function requireRole(role: Role) {
  const user = await getCurrentUser();
  if (user.role !== role) forbidden();
  return user;
}

export const roleLabel: Record<Role, string> = { ADMIN: "Gérant·e", EMPLOYEE: "Employé·e" };
