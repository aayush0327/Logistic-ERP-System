import { Suspense } from "react";
import DashboardClient from "./DashboardClient";

// Cache the orders data for 5 minutes (300 seconds)

export default async function BranchManagerDashboard() {
  return (
    <Suspense fallback={<div>Loading dashboard...</div>}>
      <DashboardClient />
    </Suspense>
  );
}

// Export revalidate for ISR (Incremental Static Regeneration)
export const revalidate = 300; // Revalidate every 5 minutes

// Export dynamic rendering configuration
export const dynamic = "force-static";
