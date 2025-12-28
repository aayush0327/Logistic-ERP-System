"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function BranchManagerIndex() {
  const router = useRouter();

  useEffect(() => {
    router.push("/branch-manager/dashboard");
  }, [router]);

  return null;
}
