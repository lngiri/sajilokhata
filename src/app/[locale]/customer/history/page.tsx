import { getMessages } from "next-intl/server";
import CustomerHistoryClient from "./CustomerHistoryClient";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ merchantId?: string; shopName?: string }>;
}

export default async function HistoryPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  const messages = await getMessages();

  return (
    <CustomerHistoryClient
      locale={locale}
      messages={messages}
      merchantId={sp.merchantId || ""}
      shopName={sp.shopName || ""}
    />
  );
}
