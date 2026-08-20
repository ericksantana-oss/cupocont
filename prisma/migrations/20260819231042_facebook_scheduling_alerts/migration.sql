-- AlterTable
ALTER TABLE "instagram_accounts" ADD COLUMN     "facebookScheduleCheckedAt" TIMESTAMP(3),
ADD COLUMN     "facebookScheduledCount" INTEGER,
ADD COLUMN     "facebookScheduledUntil" TIMESTAMP(3);
