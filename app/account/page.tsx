import type { Metadata } from "next";
import { MemberAccountPage } from "@/components/MemberAccountPage";
export const metadata: Metadata = {
  title: "マイグループ - EkiHub",
  robots: { index: false, follow: false },
  alternates: { canonical: "/account" },
};
export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return <MemberAccountPage authError={Boolean((await searchParams).error)} />;
}
