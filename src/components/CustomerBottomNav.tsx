"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import BottomNavBar, { type NavItem } from "@/components/BottomNavBar";
import { HomeIcon, HistoryIcon, SettingsIcon } from "@/components/NavIcons";

interface Props {
  locale: string;
}

export default function CustomerBottomNav({ locale }: Props) {
  const pathname = usePathname();
  const t = useTranslations("bottomNav");

  const navItems: NavItem[] = [
    { href: `/${locale}/customer/dashboard`, label: t("home"), icon: HomeIcon },
    { href: `/${locale}/customer/history`, label: t("history"), icon: HistoryIcon },
    { href: `/${locale}/customer/settings`, label: t("settings"), icon: SettingsIcon },
  ];

  return (
    <BottomNavBar
      items={navItems}
      isActive={(href) => pathname === href || (href !== "/" && pathname.startsWith(href))}
      navLabel="Customer navigation"
    />
  );
}