-- CreateEnum
CREATE TYPE "ActivityAction" AS ENUM ('CONTEXT_UPDATED', 'KEYWORDS_RESEARCHED', 'BRIEFING_SAVED', 'THEMES_GENERATED', 'THEME_SELECTED', 'THEME_DISCARDED', 'TEXT_GENERATED', 'TEXT_EDITED', 'TEXT_APPROVED');

-- DropIndex
DROP INDEX "document_chunks_embedding_idx";

-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "ownerId" TEXT;

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" "ActivityAction" NOT NULL,
    "detail" TEXT,
    "period" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activity_logs_clientId_idx" ON "activity_logs"("clientId");

-- CreateIndex
CREATE INDEX "activity_logs_userId_idx" ON "activity_logs"("userId");

-- CreateIndex
CREATE INDEX "activity_logs_createdAt_idx" ON "activity_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
