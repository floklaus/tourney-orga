import { Suspense } from "react";
import { TemplatesPage } from "@/components/templates/templates-page";
import { LoadingState } from "@/components/ui/states";

export default function Page() {
  return (
    <Suspense fallback={<LoadingState />}>
      <TemplatesPage />
    </Suspense>
  );
}
