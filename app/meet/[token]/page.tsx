import type { Metadata } from "next";
import { WorkspacePage } from "@/components/WorkspacePage";
export const metadata: Metadata = {
  title: "集合ページ - EkiHub",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <WorkspacePage token={token} />;
}
