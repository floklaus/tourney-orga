import { Suspense } from "react";
import { DeliveriesPage } from "@/components/deliveries/deliveries-page";
import { LoadingState } from "@/components/ui/states";

export default function Page() {
  return (
    <Suspense fallback={<LoadingState />}>
      <DeliveriesPage />
    </Suspense>
  );
}
