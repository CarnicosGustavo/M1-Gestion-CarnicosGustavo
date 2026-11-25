import { AdminLayout } from "@/components/admin-layout";
import { getAuthUser } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Layout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const user = await getAuthUser();
	return <AdminLayout userRole={user?.role ?? null}>{children}</AdminLayout>;
}
