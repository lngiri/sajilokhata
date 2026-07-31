"use client";

import { usePathname } from "next/navigation";
import BottomNavBar, { type NavItem } from "@/components/BottomNavBar";
import { HomeIcon, HistoryIcon, SettingsIcon } from "@/components/NavIcons";

const navItems: NavItem[] = [
  { href: "/customer/dashboard", label: "Home", icon: HomeIcon },
  { href: "/customer/history", label: "History", icon: HistoryIcon },
  { href: "/customer/settings", label: "Settings", icon: SettingsIcon },
];

export default function CustomerBottomNav() {
  const pathname = usePathname();

  return (
    <BottomNavBar
      items={navItems}
      isActive={(href) => pathname === href || (href !== "/" && pathname.startsWith(href))}
      navLabel="Customer navigation"
    />
  );
}
