import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import { AppHeader } from "../../components/AppHeader";

// The real authorization boundary — not just the middleware matcher.
// Wraps /dashboard and /categories without changing their URLs.
export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="app-shell">
      <AppHeader />
      <main>{children}</main>
    </div>
  );
}
