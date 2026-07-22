import DoodleSpinner from "@/components/DoodleSpinner";

export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-dvh">
      <DoodleSpinner size="lg" text="Loading..." />
    </div>
  );
}
