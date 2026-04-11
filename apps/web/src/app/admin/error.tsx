"use client";

import { useEffect } from "react";
import { Button } from "@finopenpos/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@finopenpos/ui/components/card";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-2xl py-10">
      <Card>
        <CardHeader>
          <CardTitle>Error en administración</CardTitle>
          <CardDescription>{error.message}</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-2">
          <Button onClick={() => reset()}>Reintentar</Button>
          {error.digest ? (
            <span className="text-xs text-muted-foreground">Digest: {error.digest}</span>
          ) : null}
        </CardContent>
        {error.stack ? (
          <CardContent>
            <pre className="max-h-80 overflow-auto rounded-md bg-muted p-3 text-xs">
              {error.stack}
            </pre>
          </CardContent>
        ) : null}
      </Card>
    </div>
  );
}
