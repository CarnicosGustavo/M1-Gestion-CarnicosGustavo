import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@finopenpos/ui/components/skeleton";

export default function PaymentsTab() {
  const router = useRouter();

  useEffect(() => {
    router.push("/admin/payment-methods");
  }, [router]);

  return (
    <div className="space-y-4">
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <p className="text-muted-foreground text-sm mt-4">Redireccionando...</p>
    </div>
  );
}
