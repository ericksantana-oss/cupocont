-- CreateTable
CREATE TABLE "instagram_pending_selections" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "candidates" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "instagram_pending_selections_pkey" PRIMARY KEY ("id")
);
