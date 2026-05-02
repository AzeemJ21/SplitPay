import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/mongoose";
import User, { INotificationPrefs } from "@/models/User";

const schema = z.object({
  emailProjectAssignment: z.boolean().optional(),
  emailMilestoneFunded: z.boolean().optional(),
  emailWorkSubmitted: z.boolean().optional(),
  emailPaymentReleased: z.boolean().optional(),
  emailPaymentFailed: z.boolean().optional(),
});

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await connectDB();

    const json = await request.json();
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", issues: parsed.error.flatten() }, { status: 400 });
    }

    const user = await User.findById(session.user.id);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const cur = (user.notificationPrefs ?? {}) as Partial<INotificationPrefs>;
    const next: INotificationPrefs = {
      emailProjectAssignment: parsed.data.emailProjectAssignment ?? cur.emailProjectAssignment ?? true,
      emailMilestoneFunded: parsed.data.emailMilestoneFunded ?? cur.emailMilestoneFunded ?? true,
      emailWorkSubmitted: parsed.data.emailWorkSubmitted ?? cur.emailWorkSubmitted ?? true,
      emailPaymentReleased: parsed.data.emailPaymentReleased ?? cur.emailPaymentReleased ?? true,
      emailPaymentFailed: parsed.data.emailPaymentFailed ?? cur.emailPaymentFailed ?? true,
    };

    user.notificationPrefs = next;
    await user.save();

    return NextResponse.json({ data: { notificationPrefs: next } });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
