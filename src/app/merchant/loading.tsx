import DoodleSpinner from "@/components/DoodleSpinner";

export default function MerchantLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-dvh pb-20">
      <DoodleSpinner size="lg" text="Loading dashboard..." />
    </div>
  );
}
