"use client";

import { signup } from "./actions";
import { Card, CardContent, CardFooter } from "@finopenpos/ui/components/card";
import { Label } from "@finopenpos/ui/components/label";
import { Input } from "@finopenpos/ui/components/input";
import Link from "next/link";
import { Button } from "@finopenpos/ui/components/button";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { CLIENT_NAME, PROJECT_CREDIT } from "@/lib/constants";

export default function SignupForm() {
  const t = useTranslations("signup");
  const searchParams = useSearchParams();
  const created = searchParams.get("created") === "1";
  const error = searchParams.get("error");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="mx-auto w-full max-w-md space-y-6">
        <div className="flex flex-col items-center space-y-2">
          <div className="text-center text-lg font-semibold">{CLIENT_NAME}</div>
          <h2 className="text-2xl font-bold">{t("title")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
        <Card>
          <form>
            <CardContent className="space-y-4 mt-4">
              <div className="grid gap-2">
                <Label htmlFor="name">{t("name")}</Label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  placeholder={t("namePlaceholder")}
                  required
                  autoComplete="name"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">{t("email")}</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder={t("emailPlaceholder")}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">{t("password")}</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder={t("passwordPlaceholder")}
                  minLength={8}
                  required
                  autoComplete="new-password"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="role">Rol</Label>
                <select
                  id="role"
                  name="role"
                  defaultValue="cajero"
                  className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  <option value="cajero">Cajero</option>
                  <option value="almacen">Almacén</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              {created && (
                <p className="text-sm text-green-600">Usuario creado.</p>
              )}
              {error && (
                <p className="text-sm text-destructive">
                  {error === "forbidden"
                    ? "Solo un administrador puede crear usuarios."
                    : "No se pudo crear el usuario (¿correo ya registrado o contraseña inválida?)."}
                </p>
              )}
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button className="w-full" formAction={signup}>
                {t("submit")}
              </Button>
              <p className="text-sm text-center text-muted-foreground">
                <Link href="/admin" className="text-primary underline-offset-4 hover:underline">
                  Volver al panel
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
        <div className="text-center text-xs text-muted-foreground">
          {PROJECT_CREDIT}
        </div>
      </div>
    </div>
  );
}
