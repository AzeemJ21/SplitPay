import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/mongoose";
import User from "@/models/User";

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const qRaw = url.searchParams.get("q") ?? "";
    const q = qRaw.trim();

    if (!q) {
      return NextResponse.json({ data: [] });
    }

    await connectDB();

    const sessionOid = new Types.ObjectId(session.user.id);
    const baseFilter = { _id: { $ne: sessionOid } };

    const strippedHash = q.startsWith("#") ? q.slice(1) : q;
    const isSplitCodeQuery = q.startsWith("#") || /^\d{4}$/.test(q);

    if (isSplitCodeQuery && !strippedHash) {
      return NextResponse.json({ data: [] });
    }

    let filter: Record<string, unknown>;

    if (isSplitCodeQuery) {
      filter = {
        ...baseFilter,
        splitCode: strippedHash,
      };
    } else {
      const esc = escapeRegex(q);
      filter = {
        ...baseFilter,
        $or: [{ name: { $regex: esc, $options: "i" } }, { email: { $regex: esc, $options: "i" } }],
      };
    }

    const users = await User.find(filter).select("-passwordHash").limit(10).lean();

    const data = users.map((u) => ({
      id: u._id.toString(),
      name: u.name,
      email: u.email,
      splitCode: u.splitCode,
    }));

    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
