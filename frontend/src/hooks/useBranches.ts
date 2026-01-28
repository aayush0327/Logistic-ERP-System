import { useState, useEffect } from "react";
import { BranchesListResponse } from "@/services/analytics";

export function useBranches() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBranches() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/company/branches?per_page=100");
        if (!response.ok) {
          throw new Error("Failed to fetch branches");
        }
        const data: BranchesListResponse = await response.json();
        setBranches(data.items || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    }

    fetchBranches();
  }, []);

  return { branches, loading, error };
}
