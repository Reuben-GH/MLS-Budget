"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "../lib/supabase/client";

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="mls-header">
      <div className="mls-header-left">
        <div className="logo-badge">MLS</div>
        <div>
          <div className="header-title">My Life Sorted</div>
          <div className="header-sub">Budget</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <nav className="header-nav">
          <Link href="/dashboard" className={pathname === "/dashboard" ? "active" : ""}>
            Dashboard
          </Link>
          <Link href="/categories" className={pathname === "/categories" ? "active" : ""}>
            Categories
          </Link>
          <Link href="/import" className={pathname === "/import" ? "active" : ""}>
            Import
          </Link>
        </nav>
        <button className="sign-out-btn" onClick={handleSignOut} type="button">
          Sign out
        </button>
      </div>
    </header>
  );
}
