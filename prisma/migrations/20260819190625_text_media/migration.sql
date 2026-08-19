-- CreateEnum
CREATE TYPE "MediaFormat" AS ENUM ('IMAGE', 'CAROUSEL', 'REELS', 'VIDEO');

-- AlterTable
ALTER TABLE "generated_texts" ADD COLUMN     "mediaFormat" "MediaFormat",
ADD COLUMN     "mediaPaths" JSONB;
