-- Os snapshots ja gravados nasceram com o bug da janela de 30 dias (reach = 0).
-- Limpa para serem recapturados com a leitura corrigida.
DELETE FROM "metric_snapshots";

-- AlterTable
ALTER TABLE "metric_snapshots" ADD COLUMN     "accountsEngaged" INTEGER,
ADD COLUMN     "closed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "dailyReach" JSONB,
ADD COLUMN     "fbEngagement" INTEGER,
ADD COLUMN     "fbFollowers" INTEGER,
ADD COLUMN     "fbNewFollowers" INTEGER,
ADD COLUMN     "fbPageViews" INTEGER,
ADD COLUMN     "fbPosts" JSONB,
ADD COLUMN     "interactions" INTEGER,
ADD COLUMN     "posts" JSONB,
ADD COLUMN     "reachUnique" INTEGER,
ADD COLUMN     "views" INTEGER,
ADD COLUMN     "websiteClicks" INTEGER;
