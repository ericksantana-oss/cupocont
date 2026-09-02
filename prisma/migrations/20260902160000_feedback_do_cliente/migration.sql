-- Feedback do cliente sobre cada post, entre finalizar a producao e agendar.

CREATE TYPE "ClientVerdict" AS ENUM ('APPROVED', 'REJECTED');

CREATE TABLE "client_feedbacks" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "demandId" TEXT NOT NULL,
  "themeId" TEXT NOT NULL,
  "verdict" "ClientVerdict" NOT NULL,
  "comment" TEXT,
  "registeredById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "client_feedbacks_pkey" PRIMARY KEY ("id")
);

-- Um veredito por post.
CREATE UNIQUE INDEX "client_feedbacks_themeId_key" ON "client_feedbacks"("themeId");
CREATE INDEX "client_feedbacks_clientId_createdAt_idx" ON "client_feedbacks"("clientId", "createdAt");

ALTER TABLE "client_feedbacks" ADD CONSTRAINT "client_feedbacks_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_feedbacks" ADD CONSTRAINT "client_feedbacks_demandId_fkey"
  FOREIGN KEY ("demandId") REFERENCES "content_demands"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_feedbacks" ADD CONSTRAINT "client_feedbacks_themeId_fkey"
  FOREIGN KEY ("themeId") REFERENCES "content_themes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_feedbacks" ADD CONSTRAINT "client_feedbacks_registeredById_fkey"
  FOREIGN KEY ("registeredById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'CLIENT_FEEDBACK';
