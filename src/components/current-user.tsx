import { logout } from "@/app/connexion/actions";
import { getCurrentUser, roleLabel } from "@/lib/auth";
import { SideNav } from "./navigation";
import { focusRing } from "./ui/button";
import { Avatar } from "./ui/card";
import { Icon } from "./ui/icons";

// Parties de la coquille qui dépendent de l'utilisateur : rendues sous <Suspense> dans le layout.
export async function UserNav() {
  const user = await getCurrentUser();
  return <SideNav isAdmin={user.role === "ADMIN"} />;
}

// Barre supérieure mobile (maquette « Barre supérieure ») : la barre latérale y est masquée.
export async function MobileUserBar() {
  const user = await getCurrentUser();
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-foreground-light">{user.name}</span>
      <form action={logout}>
        <button type="submit" className={`flex min-h-11 items-center gap-2 rounded-sm px-2 font-semibold ${focusRing}`}>
          <Icon name="deconnexion" />
          <span className="sr-only">Se déconnecter</span>
        </button>
      </form>
    </div>
  );
}

export async function UserCard() {
  const user = await getCurrentUser();
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-3 px-3 py-3">
        <Avatar name={user.name} />
        <span className="flex flex-col text-sm">
          <span className="font-semibold">{user.name}</span>
          <span className="text-foreground-light">{roleLabel[user.role]}</span>
        </span>
      </div>
      <form action={logout}>
        <button type="submit" className={`flex min-h-11 w-full items-center gap-3 rounded-sm px-3 hover:bg-background-alt ${focusRing}`}>
          <Icon name="deconnexion" />
          Se déconnecter
        </button>
      </form>
    </div>
  );
}
