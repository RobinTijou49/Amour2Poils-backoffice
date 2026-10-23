// Message de retour d'une action, annoncé par les lecteurs d'écran (role="status" / "alert").
export function FormMessage({ error, success }: { error?: string; success?: string }) {
  return (
    <>
      <p role="alert" className="empty:hidden rounded-sm bg-danger-bg px-3 py-2 text-sm font-semibold text-danger-fg">
        {error}
      </p>
      <p role="status" className="empty:hidden rounded-sm bg-success-bg px-3 py-2 text-sm font-semibold text-success-fg">
        {success}
      </p>
    </>
  );
}
