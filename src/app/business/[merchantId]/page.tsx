import { getAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ merchantId: string }>;
}

export default async function BusinessProfilePage({ params }: Props) {
  const { merchantId } = await params;

  const admin = getAdminClient();
  if (!admin) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-6 bg-gray-50">
        <p className="text-sm text-gray-500">Service unavailable</p>
      </div>
    );
  }

  const { data: merchant, error } = await (admin.from("merchants") as any)
    .select("name, business_name, business_type, address, phone")
    .eq("id", merchantId)
    .maybeSingle();

  if (error || !merchant) {
    notFound();
  }

  const displayName = merchant.business_name || merchant.name || "Shop";
  const phone = merchant.phone || "";
  const phoneDigits = phone.replace(/\D/g, "");

  return (
    <div className="min-h-dvh flex flex-col bg-gradient-to-b from-white to-gray-50">
      {/* Header */}
      <div className="relative h-48 bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dark)]">
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <h1 className="text-2xl font-bold text-white">{displayName}</h1>
          {merchant.business_type && (
            <p className="text-sm text-white/80 capitalize mt-1">
              {merchant.business_type} Shop
            </p>
          )}
        </div>
      </div>

      <div className="flex-1 px-4 py-6 space-y-4">
        {/* Address */}
        {merchant.address && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50 flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)] mb-0.5">Address</p>
              <p className="text-sm font-medium text-[var(--color-text)]">
                {merchant.address}
              </p>
            </div>
          </div>
        )}

        {/* Phone / Contact */}
        {phone && (
          <a
            href={`tel:${phoneDigits}`}
            className="block bg-white rounded-2xl p-4 shadow-sm border border-gray-50 flex items-center gap-3 active:scale-[0.99] transition-transform"
          >
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-xs text-[var(--color-text-muted)] mb-0.5">Contact</p>
              <p className="text-sm font-medium text-[var(--color-text)]">
                {phone}
              </p>
            </div>
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </a>
        )}

        {/* WhatsApp */}
        {phoneDigits && (
          <a
            href={`https://wa.me/${phoneDigits}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-white rounded-2xl p-4 shadow-sm border border-gray-50 flex items-center gap-3 active:scale-[0.99] transition-transform"
          >
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-xs text-[var(--color-text-muted)] mb-0.5">Chat on WhatsApp</p>
              <p className="text-sm font-medium text-green-700">Send a message</p>
            </div>
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </a>
        )}

        {/* Powered by */}
        <div className="text-center pt-4 pb-8">
          <p className="text-xs text-[var(--color-text-muted)]">
            Powered by <span className="font-semibold text-[var(--color-primary)]">SajiloKhata</span>
          </p>
        </div>
      </div>
    </div>
  );
}
