"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SuperAdminIndex() {
  const router = useRouter();

  useEffect(() => {
    router.push("/super-admin/dashboard");
  }, [router]);

  return null;
}
