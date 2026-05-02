import bcrypt from "bcryptjs";
import mongoose from "mongoose";

const MONGODB_URI =
  process.env.MONGODB_URI ||
  "mongodb+srv://maheenirshad894_db_user:<PASSWORD>@cluster0.fzdsp6n.mongodb.net/splitpay?retryWrites=true&w=majority&appName=Cluster0";

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB");

  const { default: User } = await import("../models/User");
  const { default: Project } = await import("../models/Project");
  const { default: Milestone } = await import("../models/Milestone");
  const { default: Transaction } = await import("../models/Transaction");
  const { default: VirtualCard } = await import("../models/VirtualCard");
  const { generateApiKey, monthKey } = await import("../lib/api-key");
  const { generateVirtualCardNumber } = await import("../lib/virtual-card-utils");

  await Promise.all([
    User.deleteMany({ email: /splitpay\.io$/ }),
    Project.deleteMany({}),
    Milestone.deleteMany({}),
    Transaction.deleteMany({}),
    VirtualCard.deleteMany({}),
  ]);

  const passwordHash = await bcrypt.hash("password123", 12);

  const nowYear = new Date().getFullYear();
  const client = await User.create({
    name: "Demo Client",
    email: "client@splitpay.io",
    passwordHash,
    splitCode: "4821",
    roles: ["user"],
    apiKey: generateApiKey(),
    apiUsageBillingMonth: monthKey(),
    apiCallsThisMonth: 0,
  });

  const freelancer = await User.create({
    name: "Demo Freelancer",
    email: "freelancer@splitpay.io",
    passwordHash,
    splitCode: "9912",
    roles: ["user"],
    apiKey: generateApiKey(),
    apiUsageBillingMonth: monthKey(),
    apiCallsThisMonth: 0,
  });

  await VirtualCard.insertMany([
    {
      userId: client._id,
      balance: 0,
      currency: "USD",
      cardNumber: generateVirtualCardNumber(),
      expiryMonth: 12,
      expiryYear: nowYear + 3,
    },
    {
      userId: freelancer._id,
      balance: 0,
      currency: "USD",
      cardNumber: generateVirtualCardNumber(),
      expiryMonth: 12,
      expiryYear: nowYear + 3,
    },
  ]);

  const project1 = await Project.create({
    clientId: client._id,
    freelancerId: freelancer._id,
    title: "SplitPay Dashboard Redesign",
    description: "Full UI overhaul",
    budget: 3000,
    deadline: new Date("2026-12-31"),
    status: "active",
  });

  const project2 = await Project.create({
    clientId: client._id,
    freelancerId: freelancer._id,
    title: "API Integration Module",
    description: "REST API build",
    budget: 1500,
    deadline: new Date("2026-11-15"),
    status: "pending",
  });

  await Milestone.insertMany([
    {
      projectId: project1._id,
      title: "UI Design",
      amount: 800,
      dueDate: new Date("2025-08-01"),
      status: "released",
      escrowAmount: 0,
    },
    {
      projectId: project1._id,
      title: "Backend Development",
      amount: 1200,
      dueDate: new Date("2025-09-01"),
      status: "funded",
      escrowAmount: 1200,
    },
    {
      projectId: project1._id,
      title: "Final Delivery",
      amount: 1000,
      dueDate: new Date("2025-10-01"),
      status: "pending",
      escrowAmount: 0,
    },
    {
      projectId: project2._id,
      title: "API Architecture",
      amount: 500,
      dueDate: new Date("2025-08-15"),
      status: "in_progress",
      escrowAmount: 500,
    },
    {
      projectId: project2._id,
      title: "Testing & QA",
      amount: 1000,
      dueDate: new Date("2025-09-15"),
      status: "pending",
      escrowAmount: 0,
    },
  ]);

  const mkTxnId = (i: number) =>
    `TXN-seed-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  await Transaction.insertMany([
    {
      userId: client._id,
      splitCode: "4821",
      amount: 800,
      card1Amount: 500,
      card2Amount: 300,
      type: "escrow_funding",
      status: "completed",
      transactionId: mkTxnId(1),
    },
    {
      userId: client._id,
      splitCode: "4821",
      amount: 1200,
      card1Amount: 700,
      card2Amount: 500,
      type: "escrow_funding",
      status: "completed",
      transactionId: mkTxnId(2),
    },
    {
      userId: client._id,
      splitCode: "4821",
      amount: 800,
      card1Amount: 800,
      card2Amount: 0,
      type: "escrow_release",
      status: "completed",
      transactionId: mkTxnId(3),
    },
    {
      userId: client._id,
      splitCode: "4821",
      amount: 500,
      card1Amount: 300,
      card2Amount: 200,
      type: "escrow_funding",
      status: "completed",
      transactionId: mkTxnId(4),
    },
    {
      userId: client._id,
      splitCode: "4821",
      amount: 200,
      card1Amount: 100,
      card2Amount: 100,
      type: "split_payment",
      status: "completed",
      transactionId: mkTxnId(5),
    },
    {
      userId: client._id,
      splitCode: "4821",
      amount: 350,
      card1Amount: 200,
      card2Amount: 150,
      type: "failed_payment",
      status: "failed",
      transactionId: mkTxnId(6),
    },
    {
      userId: client._id,
      splitCode: "4821",
      amount: 900,
      card1Amount: 500,
      card2Amount: 400,
      type: "split_payment",
      status: "completed",
      transactionId: mkTxnId(7),
    },
    {
      userId: client._id,
      splitCode: "4821",
      amount: 100,
      card1Amount: 60,
      card2Amount: 40,
      type: "split_payment",
      status: "completed",
      transactionId: mkTxnId(8),
    },
    {
      userId: client._id,
      splitCode: "4821",
      amount: 450,
      card1Amount: 250,
      card2Amount: 200,
      type: "escrow_funding",
      status: "pending",
      transactionId: mkTxnId(9),
    },
    {
      userId: client._id,
      splitCode: "4821",
      amount: 750,
      card1Amount: 400,
      card2Amount: 350,
      type: "split_payment",
      status: "completed",
      transactionId: mkTxnId(10),
    },
  ]);

  console.log("✅ Seed complete!");
  console.log("   Demo login → client@splitpay.io / password123 (split code: 4821)");
  console.log("   Demo login → freelancer@splitpay.io / password123 (split code: 9912)");
  await mongoose.disconnect();
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
