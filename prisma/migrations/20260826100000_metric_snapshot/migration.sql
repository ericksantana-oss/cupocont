-- CreateTable
CREATE TABLE "metric_snapshots" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "followers" INTEGER,
    "mediaCount" INTEGER,
    "reach" INTEGER,
    "profileViews" INTEGER,
    "capturedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "metric_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "metric_snapshots_clientId_period_idx" ON "metric_snapshots"("clientId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "metric_snapshots_clientId_period_key" ON "metric_snapshots"("clientId", "period");

-- AddForeignKey
ALTER TABLE "metric_snapshots" ADD CONSTRAINT "metric_snapshots_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
