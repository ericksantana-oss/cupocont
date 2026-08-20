-- CreateTable
CREATE TABLE "market_news" (
    "id" TEXT NOT NULL,
    "guid" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "link" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "pubDate" TIMESTAMP(3) NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_news_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "market_news_guid_key" ON "market_news"("guid");

-- CreateIndex
CREATE INDEX "market_news_pubDate_idx" ON "market_news"("pubDate");
