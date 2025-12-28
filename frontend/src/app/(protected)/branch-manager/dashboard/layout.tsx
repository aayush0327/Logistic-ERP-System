import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Branch Manager Dashboard | Logistic ERP",
  description: "Manage orders and view dashboard analytics",
};

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}