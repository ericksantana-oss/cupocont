-- CreateEnum
CREATE TYPE "MarketingEmailType" AS ENUM ('PONTUAL', 'FLUXO');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('DRAFT', 'REVIEW', 'APPROVED');

-- CreateTable
CREATE TABLE "email_flows" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_flows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_emails" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "flowId" TEXT,
    "type" "MarketingEmailType" NOT NULL,
    "name" TEXT NOT NULL,
    "briefing" TEXT NOT NULL,
    "status" "EmailStatus" NOT NULL DEFAULT 'DRAFT',
    "subjectA" TEXT,
    "subjectB" TEXT,
    "preheader" TEXT,
    "hasCard" BOOLEAN NOT NULL DEFAULT false,
    "cardText" TEXT,
    "body" TEXT,
    "ctaText" TEXT,
    "farewell" TEXT,
    "audience" TEXT,
    "senderName" TEXT,
    "senderEmail" TEXT,
    "ctaColor" TEXT,
    "imagesFolderUrl" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_emails_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "email_flows" ADD CONSTRAINT "email_flows_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_emails" ADD CONSTRAINT "marketing_emails_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_emails" ADD CONSTRAINT "marketing_emails_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "email_flows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_emails" ADD CONSTRAINT "marketing_emails_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
