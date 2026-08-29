-- Latency engine, clarification approvals, system warnings and request audit.
-- Team default shift start (latency reference for members' clock-ins).
ALTER TABLE "Team" ADD COLUMN "shiftStartDefault" TEXT NOT NULL DEFAULT '09:00';

-- Attendance latency tracking.
ALTER TABLE "Attendance" ADD COLUMN "scheduledStart" TIMESTAMP(3);
ALTER TABLE "Attendance" ADD COLUMN "lateMinutes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Attendance" ADD COLUMN "latencyCleared" BOOLEAN NOT NULL DEFAULT false;

-- CreateEnum
CREATE TYPE "ClarificationStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED');
CREATE TYPE "WarningKind" AS ENUM ('SYSTEM', 'MANUAL');

-- CreateTable
CREATE TABLE "ClarificationRequest" (
    "id" TEXT NOT NULL,
    "attendanceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "ClarificationStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decisionNote" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClarificationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warning" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "kind" "WarningKind" NOT NULL DEFAULT 'SYSTEM',
    "issuedBy" TEXT NOT NULL DEFAULT 'SYSTEM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Warning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequestRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClarificationRequest_status_createdAt_idx" ON "ClarificationRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ClarificationRequest_userId_idx" ON "ClarificationRequest"("userId");

-- CreateIndex
CREATE INDEX "Warning_userId_createdAt_idx" ON "Warning"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "RequestRecord_userId_createdAt_idx" ON "RequestRecord"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "ClarificationRequest" ADD CONSTRAINT "ClarificationRequest_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "Attendance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClarificationRequest" ADD CONSTRAINT "ClarificationRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClarificationRequest" ADD CONSTRAINT "ClarificationRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warning" ADD CONSTRAINT "Warning_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestRecord" ADD CONSTRAINT "RequestRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
