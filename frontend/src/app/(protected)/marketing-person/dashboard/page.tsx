import { Suspense } from "react";
import DashboardClient from "./DashboardClient";

export default async function MarketingPersonDashboardPage() {
  return (
    <Suspense fallback={<div>Loading dashboard...</div>}>
      <DashboardClient />
    </Suspense>
  );
}

export const revalidate = 300;
export const dynamic = "force-static";
