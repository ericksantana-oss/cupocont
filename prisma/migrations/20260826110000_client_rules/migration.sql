-- CreateTable
CREATE TABLE "client_rules" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "rule" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_rules_clientId_idx" ON "client_rules"("clientId");

-- AddForeignKey
ALTER TABLE "client_rules" ADD CONSTRAINT "client_rules_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_rules" ADD CONSTRAINT "client_rules_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
