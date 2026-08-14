import { getMessages } from "next-intl/server";
import CustomerSettingsClient from "./CustomerSettingsClient";

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function SettingsPage({ params }: Props) {
  const { locale } = await params;
  const messages = await getMessages();

  return <CustomerSettingsClient locale={locale} messages={messages} />;
}
