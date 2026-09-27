import { Suspense } from "react";
import { UsersPage } from "@/components/users/users-page";
import { LoadingState } from "@/components/ui/states";

export default function Page() {
  return (
    <Suspense fallback={<LoadingState />}>
      <UsersPage />
    </Suspense>
  );
}
