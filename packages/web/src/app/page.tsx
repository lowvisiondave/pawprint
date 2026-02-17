// Dashboard data fetcher (Server Component)
import DashboardClient from "./dashboard-client";

async function getDashboardData(workspaceId: string) {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://web-xi-khaki.vercel.app";
  
  try {
    const res = await fetch(`${API_URL}/api/v1/dashboard?workspace_id=${workspaceId}`, {
      next: { revalidate: 30 } // Cache for 30 seconds
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ workspace_id?: string }>;
}) {
  const params = await searchParams;
  const workspaceId = params.workspace_id || "1";
  const data = await getDashboardData(workspaceId);
  
  return <DashboardClient initialData={data} workspaceId={workspaceId} />;
}
