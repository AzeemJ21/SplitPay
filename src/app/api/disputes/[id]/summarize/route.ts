import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AI_AGENT_RESPONSE_DELAY_MS } from "@/lib/constants";
import { connectDB } from "@/lib/mongoose";
import Dispute from "@/models/Dispute";
import Message from "@/models/Message";
import Project from "@/models/Project";

function buildOfflineSummary(dispute: {
  title: string;
  description: string;
  type?: string;
  createdAt: Date;
}) {
  const t = dispute.type ?? "milestone_dispute";
  return `
1. SUMMARY: Automated triage review for "${dispute.title}". The dispute was filed under type ${t.replace(/_/g, " ")}. Review the description and evidence below.

2. TIMELINE: Complaint filed at ${dispute.createdAt.toISOString()}. Follow-up steps may include requesting additional proof from both parties.

3. EVIDENCE ASSESSMENT: Screenshots and attachments should be compared against milestone scope and chat history. Verify dates and deliverables mentioned in the description.

4. RISK INDICATORS: Look for conflicting statements between chat logs and submitted work; unclear scope increases mediation complexity.

5. PRELIMINARY ASSESSMENT: No final ruling — gather responses from client and freelancer before deciding release or refund.

6. RISK SCORE: 5

7. RECOMMENDATION: Keep status under review until both parties submit clarifications. Escalate if payment or fraud patterns emerge.

---
(Dashboard AI agent — offline template. Add ANTHROPIC_API_KEY on the server for full Claude analysis.)

Description excerpt:
${dispute.description.slice(0, 1200)}${dispute.description.length > 1200 ? "…" : ""}
`.trim();
}

export async function POST(_: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!Types.ObjectId.isValid(params.id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await connectDB();
    const userId = session.user.id;

    const dispute = await Dispute.findById(params.id).populate("raisedBy", "name").lean();
    if (!dispute) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const createdAt =
      dispute.createdAt instanceof Date ? dispute.createdAt : new Date(dispute.createdAt as string);
    const unlockAt = new Date(createdAt.getTime() + AI_AGENT_RESPONSE_DELAY_MS);
    if (Date.now() < unlockAt.getTime()) {
      return NextResponse.json(
        {
          error: "AI_AGENT_PENDING",
          message: "The AI agent publishes analysis 48 hours after the complaint is filed.",
          availableAt: unlockAt.toISOString(),
        },
        { status: 403 },
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514";

    const project = await Project.findOne({
      _id: dispute.projectId,
      $or: [{ clientId: userId }, { freelancerId: userId }],
    })
      .select("title budget status clientId freelancerId")
      .lean();

    if (!project) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!apiKey) {
      const summary = buildOfflineSummary({
        title: dispute.title,
        description: dispute.description,
        type: dispute.type,
        createdAt,
      });
      await Dispute.findByIdAndUpdate(params.id, {
        aiSummary: summary,
        status: dispute.status === "open" ? "under_review" : dispute.status,
      });
      return NextResponse.json({ summary, source: "offline_template" });
    }

    const messages = await Message.find({ projectId: dispute.projectId })
      .populate("senderId", "name")
      .sort({ createdAt: 1 })
      .limit(100)
      .lean();

    const chatHistory = messages
      .map((m) => {
        const s = m.senderId as unknown;
        let name = "User";
        if (s && typeof s === "object" && "name" in s) {
          name = String((s as { name?: string }).name ?? "User");
        }
        const t = m.createdAt instanceof Date ? m.createdAt : new Date(m.createdAt as string);
        return `[${t.toLocaleString()}] ${name}: ${m.content}`;
      })
      .join("\n");

    const raised = dispute.raisedBy as unknown;
    let filedByName = "User";
    if (raised && typeof raised === "object" && "name" in raised) {
      filedByName = String((raised as { name?: string }).name ?? "User");
    }

    const screenshotCount = (dispute.screenshots ?? []).length;
    const attachmentCount = (dispute.attachments ?? []).length;

    const prompt = `
You are a neutral dispute analyst for SplitPay, a freelance payment escrow platform.

DISPUTE DETAILS:
- Type: ${dispute.type ?? "milestone_dispute"}
- Title: ${dispute.title}
- Description: ${dispute.description}
- Filed by: ${filedByName}
- Date: ${dispute.createdAt instanceof Date ? dispute.createdAt.toISOString() : dispute.createdAt}

PROJECT DETAILS:
- Title: ${project.title}
- Budget: $${project.budget}
- Status: ${project.status}
- Client ID: ${project.clientId?.toString?.() ?? project.clientId}
- Freelancer ID: ${project.freelancerId?.toString?.() ?? project.freelancerId ?? "n/a"}

EVIDENCE SUBMITTED:
${screenshotCount} screenshots, ${attachmentCount} attachments

INTERNAL CHAT HISTORY (last ${messages.length} messages):
${chatHistory || "No chat messages found."}

Provide a structured analysis with these exact sections:
1. SUMMARY: Brief 2-3 sentence summary of the dispute
2. TIMELINE: Key events in chronological order
3. EVIDENCE ASSESSMENT: What the evidence suggests (screenshots described as uploaded)
4. RISK INDICATORS: Any suspicious patterns in communication or behavior
5. PRELIMINARY ASSESSMENT: Which party's claim appears stronger, and why (be objective)
6. RISK SCORE: Rate dispute severity 1-10 (1=minor, 10=serious fraud)
7. RECOMMENDATION: Suggested resolution path

IMPORTANT: This is assistive analysis only. Do not make final judgments.
Be neutral, professional, and base conclusions only on provided evidence.
`.trim();

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Anthropic error", res.status, errText);
      return NextResponse.json({ error: "AI request failed" }, { status: 502 });
    }

    const body = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const summary = body.content?.find((c) => c.type === "text")?.text?.trim();
    if (!summary) {
      return NextResponse.json({ error: "Empty AI response" }, { status: 502 });
    }

    await Dispute.findByIdAndUpdate(params.id, {
      aiSummary: summary,
      status: dispute.status === "open" ? "under_review" : dispute.status,
    });

    return NextResponse.json({ summary, source: "anthropic" });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
