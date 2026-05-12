"use client";

import { Link } from "@/lib/next-shim";
import { usePathname } from "@/lib/next-shim";

const navItems = [
  { href: "/dashboard/connections", label: "Connections" },
  { href: "/dashboard/tokens", label: "API Tokens" },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="space-y-1">
      {navItems
        .map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                isActive
                  ? "bg-wa-green/10 text-wa-green"
                  : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
    </nav>
  );
}
