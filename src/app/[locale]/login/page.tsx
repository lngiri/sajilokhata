import { getMessages } from "next-intl/server";
import LoginClient from "./LoginClient";

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function LoginPage({ params }: Props) {
  const { locale } = await params;
  const messages = await getMessages();

  return <LoginClient locale={locale} messages={messages} />;
}
