import { getMessages } from "next-intl/server";
import CustomerDashboardClient from "./CustomerDashboardClient";

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function CustomerDashboardPage({ params }: Props) {
  const { locale } = await params;
  const messages = await getMessages();

  return <CustomerDashboardClient messages={messages} locale={locale} />;
}