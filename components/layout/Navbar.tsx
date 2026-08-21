"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

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
    href: "/stats",
    children: [
      { label: "Roster", href: "/roster" },
      { label: "Leaders", href: "/stats" },
      { label: "Trends", href: "/hot-cold" },
    ],
  },
  { label: "Prospects", href: "/prospects" },
  { label: "About Us", href: "/about-us" },
];

const socialLinks = [
  {
    label: "YouTube",
    href: "https://www.youtube.com/@DealinTheCards",
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path
          fill="currentColor"
          d="M23.5 7.1a3.2 3.2 0 0 0-2.2-2.3C19.3 4.3 12 4.3 12 4.3s-7.3 0-9.3.5A3.2 3.2 0 0 0 .5 7.1 33.4 33.4 0 0 0 0 12a33.4 33.4 0 0 0 .5 4.9 3.2 3.2 0 0 0 2.2 2.3c2 .5 9.3.5 9.3.5s7.3 0 9.3-.5a3.2 3.2 0 0 0 2.2-2.3A33.4 33.4 0 0 0 24 12a33.4 33.4 0 0 0-.5-4.9ZM9.6 15.4V8.6l6.2 3.4-6.2 3.4Z"
        />
      </svg>
    ),
  },
  {
    label: "Instagram",
    href: "https://www.instagram.com/DealinTheCards",
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path
          fill="currentColor"
          d="M7.8 2h8.4A5.8 5.8 0 0 1 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8A5.8 5.8 0 0 1 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2Zm0 1.9A3.9 3.9 0 0 0 3.9 7.8v8.4a3.9 3.9 0 0 0 3.9 3.9h8.4a3.9 3.9 0 0 0 3.9-3.9V7.8a3.9 3.9 0 0 0-3.9-3.9H7.8Zm8.9 1.5a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 1.9a3.1 3.1 0 1 0 0 6.2 3.1 3.1 0 0 0 0-6.2Z"
        />
      </svg>
    ),
  },
  {
    label: "X",
    href: "https://x.com/DealinTheCards",
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path
          fill="currentColor"
          d="M18.9 2h3.7l-8.1 9.2L24 22h-7.5l-5.9-6.8L4.7 22H1l8.7-9.9L0 2h7.6l5.3 6.2L18.9 2Zm-1.3 17.8h2.1L6.4 4.1H4.1l13.5 15.7Z"
        />
      </svg>
    ),
  },
  {
    label: "TikTok",
    href: "https://www.tiktok.com/@dealinthecards",
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path
          fill="currentColor"
          d="M16.8 2c.2 1.6 1.1 3 2.5 3.9.9.6 2 .9 3.1.9v3.5a8 8 0 0 1-5.6-2.2v7.2A6.3 6.3 0 1 1 10.5 9v3.6a2.8 2.8 0 1 0 2.8 2.7V2h3.5Z"
        />
      </svg>
    ),
  },
  {
    label: "Facebook",
    href: "https://www.facebook.com/DealinTheCards",
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path
          fill="currentColor"
          d="M13.7 22v-8h2.7l.4-3h-3.1V9c0-.9.3-1.6 1.6-1.6h1.7V4.6c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.4-4 4.1V11H8v3h2.6v8h3.1Z"
        />
      </svg>
    ),
  },
  {
    label: "Spotify",
    href: "https://open.spotify.com",
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 1.8a10.2 10.2 0 1 0 0 20.4 10.2 10.2 0 0 0 0-20.4Zm4.7 14.7a.9.9 0 0 1-1.2.3 9.7 9.7 0 0 0-8.5-1.1.9.9 0 0 1-.6-1.7 11.5 11.5 0 0 1 10.1 1.3c.4.2.5.8.2 1.2Zm1.7-2.7a1.2 1.2 0 0 1-1.6.4 11.9 11.9 0 0 0-10.6-1.3 1.2 1.2 0 0 1-.8-2.2 14.3 14.3 0 0 1 12.7 1.6 1.2 1.2 0 0 1 .3 1.5Zm.2-2.8A14 14 0 0 0 5.2 9.4a1.4 1.4 0 1 1-1-2.7 16.8 16.8 0 0 1 16.1 2 1.4 1.4 0 0 1-1.7 2.3Z"
        />
      </svg>
    ),
  },
  {
    label: "Apple Podcasts",
    href: "https://podcasts.apple.com",
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 2a10 10 0 0 0-5.3 18.5.8.8 0 0 0 1.1-.3 7.6 7.6 0 0 0 .9-3.7c0-1.3-.3-2.5-.9-3.6a4.9 4.9 0 1 1 8.4 0c-.6 1.1-.9 2.3-.9 3.6 0 1.3.3 2.6.9 3.7a.8.8 0 0 0 1.1.3A10 10 0 0 0 12 2Zm0 5a2.2 2.2 0 1 0 0 4.4A2.2 2.2 0 0 0 12 7Zm0 6a2 2 0 0 0-2 2c0 1 .3 2 .9 2.8.2.3.7.3.9 0 .6-.8.9-1.8.9-2.8a2 2 0 0 0-2-2Z"
        />
      </svg>
    ),
  },
];

export default function Navbar() {
  const pathname = usePathname();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
      <nav className="container" style={{ minHeight: "4.2rem", padding: "0.8rem 0" }}>
        <div className="navbar-top-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
          <Link
            href="/"
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
              style={{ display: "block" }}
            />
            DEALIN&apos; THE CARDS
          </Link>

          <div className="navbar-controls" style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <div className="social-icons-row" style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
              {socialLinks.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={item.label}
                  title={item.label}
                  style={{
                    width: "1.95rem",
                    height: "1.95rem",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "999px",
                    border: "1px solid rgba(253,250,243, 0.45)",
                    background: "rgba(253,250,243, 0.16)",
                    color: "#fdfaf3",
                  }}
                >
                  {item.icon}
                </a>
              ))}
            </div>

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

          <div className="mobile-drawer-socials">
            {socialLinks.map((item) => (
              <a
                key={item.label}
                href={item.href}
                target="_blank"
                rel="noreferrer"
                aria-label={item.label}
                title={item.label}
                style={{
                  width: "2.2rem",
                  height: "2.2rem",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "999px",
                  border: "1px solid rgba(253,250,243, 0.45)",
                  background: "rgba(253,250,243, 0.16)",
                  color: "#fdfaf3",
                }}
              >
                {item.icon}
              </a>
            ))}
          </div>
        </div>
      </nav>
    </header>
  );
}
