-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'INTERN';

-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "squadId" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "squadId" TEXT;

-- CreateTable
CREATE TABLE "squads" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "squads_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_squadId_fkey" FOREIGN KEY ("squadId") REFERENCES "squads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_squadId_fkey" FOREIGN KEY ("squadId") REFERENCES "squads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
