"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DriverModuleIndex() {
  const router = useRouter();

  useEffect(() => {
    router.push("/drivermodule/trips");
  }, [router]);

  return null;
}
