-- AlterEnum
ALTER TYPE "ActivityAction" ADD VALUE 'POST_PUBLISHED';

-- AlterEnum
ALTER TYPE "MediaFormat" ADD VALUE 'STORIES';

-- DropForeignKey
ALTER TABLE "scheduled_posts" DROP CONSTRAINT "scheduled_posts_textId_fkey";

-- AlterTable
ALTER TABLE "scheduled_posts" ALTER COLUMN "textId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "scheduled_posts" ADD CONSTRAINT "scheduled_posts_textId_fkey" FOREIGN KEY ("textId") REFERENCES "generated_texts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
