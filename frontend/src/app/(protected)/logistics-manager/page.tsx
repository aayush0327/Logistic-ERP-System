"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LogisticsManagerIndex() {
  const router = useRouter();

  useEffect(() => {
    router.push("/logistics-manager/trips-management");
  }, [router]);

  return null;
}
