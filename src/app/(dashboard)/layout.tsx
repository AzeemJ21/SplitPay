import { Types } from "mongoose";
import { getServerSession } from "next-auth";
import User from "@/models/User";
import Dispute from "@/models/Dispute";
import Project from "@/models/Project";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/mongoose";
import { DashboardLayoutClient } from "@/components/dashboard/dashboard-layout-client";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);

  const rawId = session?.user && "id" in session.user ? (session.user as { id?: string }).id : undefined;
  if (!session?.user || !rawId || !Types.ObjectId.isValid(rawId)) {
    redirect("/login");
  }

  const userId = String(rawId);

  let userName = session.user.name ?? "SplitPay User";
  let splitCode = (session.user as { splitCode?: string }).splitCode ?? "0000";
  let openComplaintsCount = 0;

  try {
    await connectDB();
    const user = await User.findById(userId).select("name splitCode").lean();
    if (user) {
      userName = user.name ?? userName;
      splitCode = user.splitCode ?? splitCode;
    }

    const projectIds = await Project.distinct("_id", {
      $or: [{ clientId: userId }, { freelancerId: userId }],
    });
    openComplaintsCount =
      projectIds.length > 0
        ? await Dispute.countDocuments({ projectId: { $in: projectIds }, status: "open" })
        : 0;
  } catch (err) {
    console.error("[dashboard layout] DB error — check MONGODB_URI and Atlas network access:", err);
    /* Still render shell using session so user is not stuck on a blank RSC error page */
  }

  return (
    <DashboardLayoutClient userName={userName} splitCode={splitCode} openComplaintsCount={openComplaintsCount}>
      {children}
    </DashboardLayoutClient>
  );
}
