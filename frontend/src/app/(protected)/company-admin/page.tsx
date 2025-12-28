"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CompanyAdminIndex() {
  const router = useRouter();

  useEffect(() => {
    router.push("/company-admin/masters");
  }, [router]);

  return null;
}
