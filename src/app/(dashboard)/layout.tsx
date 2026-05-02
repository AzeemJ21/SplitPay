import { getServerSession } from "next-auth";
import User from "@/models/User";
import Dispute from "@/models/Dispute";
import Project from "@/models/Project";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/mongoose";
import { DashboardLayoutClient } from "@/components/dashboard/dashboard-layout-client";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  await connectDB();
  const user = await User.findById(session.user.id).select("name splitCode").lean();

  const userName = user?.name ?? session.user.name ?? "SplitPay User";
  const splitCode = user?.splitCode ?? (session.user as any).splitCode ?? "0000";

  const projectIds = await Project.distinct("_id", {
    $or: [{ clientId: session.user.id }, { freelancerId: session.user.id }],
  });
  const openComplaintsCount =
    projectIds.length > 0
      ? await Dispute.countDocuments({ projectId: { $in: projectIds }, status: "open" })
      : 0;

  return (
    <DashboardLayoutClient userName={userName} splitCode={splitCode} openComplaintsCount={openComplaintsCount}>
      {children}
    </DashboardLayoutClient>
  );
}
