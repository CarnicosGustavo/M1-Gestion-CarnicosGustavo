// This tab is a placeholder that will contain fiscal settings
// For now, it redirects to the existing fiscal settings page
// This will be fully migrated in the next iteration

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@finopenpos/ui/components/skeleton";

export default function FiscalSettingsTab() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the actual fiscal settings page
    // This is temporary until we migrate the full content here
    router.push("/admin/fiscal/settings");
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
