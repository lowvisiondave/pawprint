import StatusClient from "./status-client";

async function getStatus(slug: string) {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://web-xi-khaki.vercel.app";
  
  try {
    const res = await fetch(`${API_URL}/api/v1/status/${slug}`, {
      next: { revalidate: 30 }
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default async function StatusPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getStatus(slug);
  
  return <StatusClient data={data} slug={slug} />;
}
