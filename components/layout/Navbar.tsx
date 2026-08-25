"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

type NavChild = { label: string; href: string };
type NavItem = { label: string; href: string; children?: NavChild[] };

const navItems: NavItem[] = [
  { label: "Home", href: "/" },
  {
    label: "Podcast",
    href: "/podcast",
    children: [
      { label: "Dealin' the Cards", href: "/podcast?show=dtc" },
      { label: "Birds on the Farm", href: "/podcast?show=btf" },
    ],
  },
  { label: "Articles", href: "/articles" },
  { label: "Schedule", href: "/schedule" },
  {
    label: "Players",
    href: "/roster",
    children: [
      { label: "Roster", href: "/roster" },
      { label: "Leaders", href: "/stats" },
      { label: "Trends", href: "/hot-cold" },
      { label: "Depth Chart", href: "/depth-chart" },
      { label: "Transactions", href: "/transactions" },
    ],
  },
  { label: "Prospects", href: "/prospects" },
  { label: "About Us", href: "/about-us" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const { data: session, status } = useSession();

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 30,
        borderBottom: "1px solid var(--navy)",
        background: "linear-gradient(135deg, #c41e3a 0%, #a8172f 100%)",
      }}
    >
      <nav className="navbar-shell container" style={{ minHeight: "4.2rem", padding: "0.8rem 0" }}>
        <div className="navbar-top-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
          <Link
            href="/"
            className="navbar-logo"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.6rem",
              fontFamily: "Anton, sans-serif",
              fontSize: "1.4rem",
              letterSpacing: "0.05em",
              color: "#fdfaf3",
            }}
          >
            <img
              src="/images/logo.png"
              alt=""
              width={40}
              height={40}
              className="navbar-logo-mark"
              style={{ display: "block" }}
            />
            <span className="navbar-logo-text">DEALIN&apos; THE CARDS</span>
          </Link>

          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <div className="navbar-account">
            {status === "authenticated" && session?.user ? (
              <div
                style={{ position: "relative" }}
                onMouseEnter={() => setAccountMenuOpen(true)}
                onMouseLeave={() => setAccountMenuOpen(false)}
              >
                <button
                  type="button"
                  aria-label="Account menu"
                  aria-expanded={accountMenuOpen}
                  onClick={() => setAccountMenuOpen((open) => !open)}
                  className="navbar-avatar-button"
                  style={{
                    width: "2.2rem",
                    height: "2.2rem",
                    borderRadius: "999px",
                    border: "1px solid rgba(253,250,243, 0.45)",
                    background: "rgba(253,250,243, 0.16)",
                    overflow: "hidden",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  {session.user.image ? (
                    <img
                      src={session.user.image}
                      alt={session.user.name ?? "Account"}
                      title={session.user.name ?? undefined}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <span style={{ color: "#fdfaf3", fontWeight: 700, fontSize: "0.85rem" }}>
                      {(session.user.name ?? session.user.email ?? "?").charAt(0).toUpperCase()}
                    </span>
                  )}
                </button>

                {accountMenuOpen && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      right: 0,
                      minWidth: "160px",
                      border: "1px solid var(--line)",
                      borderRadius: "14px",
                      background: "var(--panel)",
                      boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
                      padding: "0.4rem",
                      display: "grid",
                      gap: "0.15rem",
                      zIndex: 40,
                    }}
                  >
                    {session.user.isAdmin && (
                      <p
                        style={{
                          margin: 0,
                          padding: "0.4rem 0.7rem",
                          color: "var(--muted)",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        Admin
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => signOut()}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: "0.55rem 0.7rem",
                        borderRadius: "10px",
                        color: "var(--text)",
                        fontWeight: 600,
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : status !== "loading" ? (
              <Link
                href="/sign-in"
                onClick={() => setMobileMenuOpen(false)}
                className="navbar-signin-link"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "0.5rem 0.9rem",
                  borderRadius: "999px",
                  border: "1px solid rgba(253,250,243, 0.45)",
                  background: "rgba(253,250,243, 0.16)",
                  color: "#fdfaf3",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                }}
              >
                Sign in
              </Link>
            ) : null}
          </div>

          <div className="navbar-controls" style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <button
              type="button"
              className="nav-hamburger-toggle"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((open) => !open)}
              style={{
                width: "2.2rem",
                height: "2.2rem",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "999px",
                border: "1px solid rgba(253,250,243, 0.45)",
                background: "rgba(253,250,243, 0.16)",
                color: "#fdfaf3",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
                {mobileMenuOpen ? (
                  <path
                    d="M5 5L15 15M15 5L5 15"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                ) : (
                  <>
                    <line x1="3" y1="5.5" x2="17" y2="5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <line x1="3" y1="10" x2="17" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <line x1="3" y1="14.5" x2="17" y2="14.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </>
                )}
              </svg>
            </button>
          </div>
          </div>
        </div>

        <div
          className={`nav-links-row${mobileMenuOpen ? "" : " nav-links-row-collapsed"}`}
          style={{
            display: "flex",
            gap: "1.15rem",
            flexWrap: "wrap",
            fontSize: "0.92rem",
            color: "rgba(253,250,243, 0.8)",
            marginTop: "0.6rem",
          }}
        >
          {navItems.map((item) => {
            const isActive = pathname === item.href;

            if (!item.children) {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => setMobileMenuOpen(false)}
                  style={{
                    color: isActive ? "#ffffff" : "inherit",
                    fontWeight: isActive ? 700 : 400,
                  }}
                >
                  {item.label}
                </Link>
              );
            }

            const isOpen = openMenu === item.href;

            return (
              <div
                key={item.href}
                style={{
                  position: "relative",
                  paddingBottom: "0.75rem",
                  marginBottom: "-0.75rem",
                }}
                onMouseEnter={() => setOpenMenu(item.href)}
                onMouseLeave={() => setOpenMenu(null)}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                  <Link
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    aria-haspopup="true"
                    aria-expanded={isOpen}
                    onClick={() => setMobileMenuOpen(false)}
                    style={{
                      color: isActive ? "#ffffff" : "inherit",
                      fontWeight: isActive ? 700 : 400,
                    }}
                  >
                    {item.label}
                  </Link>

                  <button
                    type="button"
                    className="nav-dropdown-toggle"
                    aria-label={`${isOpen ? "Hide" : "Show"} ${item.label} menu`}
                    aria-expanded={isOpen}
                    onClick={(event) => {
                      event.preventDefault();
                      setOpenMenu(isOpen ? null : item.href);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "inherit",
                      padding: "0.2rem",
                      cursor: "pointer",
                      fontSize: "0.7rem",
                      lineHeight: 1,
                    }}
                  >
                    {isOpen ? "▲" : "▼"}
                  </button>
                </span>

                {isOpen ? (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      minWidth: "200px",
                      border: "1px solid var(--line)",
                      borderRadius: "14px",
                      background: "var(--panel)",
                      boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
                      padding: "0.4rem",
                      display: "grid",
                      gap: "0.15rem",
                      zIndex: 40,
                    }}
                  >
                    {item.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={() => {
                          setOpenMenu(null);
                          setMobileMenuOpen(false);
                        }}
                        style={{
                          display: "block",
                          padding: "0.55rem 0.7rem",
                          borderRadius: "10px",
                          color: "var(--text)",
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
