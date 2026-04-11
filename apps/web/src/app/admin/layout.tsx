import { AdminLayout } from "@/components/admin-layout";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AdminLayout>{children}</AdminLayout>;
}
