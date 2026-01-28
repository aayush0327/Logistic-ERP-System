import { useState, useEffect } from "react";
import { useGetUserEmailsQuery } from "@/services/api/companyApi";

export interface UserEmail {
  email: string;
  name: string | null;
}

export function useUserEmails() {
  const [userEmails, setUserEmails] = useState<UserEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUserEmails() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/audit/logs/user-emails");
        if (!response.ok) {
          throw new Error("Failed to fetch user emails");
        }
        const data = await response.json();
        setUserEmails(data.items || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    }

    fetchUserEmails();
  }, []);

  return { userEmails, loading, error };
}
