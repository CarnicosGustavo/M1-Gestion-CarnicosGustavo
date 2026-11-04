"use client";

import { Button } from "@finopenpos/ui/components/button";
import { Card, CardContent, CardFooter } from "@finopenpos/ui/components/card";
import { Input } from "@finopenpos/ui/components/input";
import { Label } from "@finopenpos/ui/components/label";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRef } from "react";
import { CLIENT_NAME, PROJECT_CREDIT } from "@/lib/constants";
import { login } from "./actions";

export default function LoginPage() {
	const emailRef = useRef<HTMLInputElement>(null);
	const passwordRef = useRef<HTMLInputElement>(null);
	const t = useTranslations("login");
	const searchParams = useSearchParams();
	const error = searchParams.get("error");
	const reason = searchParams.get("reason");

	return (
		<div className="flex min-h-screen flex-col items-center justify-center bg-background">
			<div className="mx-auto w-full max-w-md space-y-6">
				<div className="flex flex-col items-center space-y-2">
					<Image
						src="/brand/logo-principal.png"
						alt={CLIENT_NAME}
						width={280}
						height={160}
						priority
						className="mb-2 h-auto w-[clamp(160px,55vw,240px)] object-contain"
					/>
					<div className="text-center text-lg font-semibold">{CLIENT_NAME}</div>
					<h2 className="text-2xl font-bold">{t("title")}</h2>
					<p className="text-sm text-muted-foreground">{t("subtitle")}</p>
				</div>
				<Card>
					<form>
						<CardContent className="space-y-4 mt-4">
							{error ? (
								<div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
									{error}
									{reason ? (
										<div className="mt-1 text-xs text-red-800">{reason}</div>
									) : null}
								</div>
							) : null}
							<div className="grid gap-2">
								<Label htmlFor="email">{t("email")}</Label>
								<Input
									ref={emailRef}
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
									ref={passwordRef}
									id="password"
									name="password"
									type="password"
									required
									autoComplete="current-password"
								/>
							</div>
						</CardContent>
						<CardFooter className="flex flex-col gap-4">
							<Button className="w-full" formAction={login}>
								{t("submit")}
							</Button>
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
