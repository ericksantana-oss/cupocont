-- CreateEnum
CREATE TYPE "PieceFormat" AS ENUM ('CARD', 'CARROSSEL');

-- AlterTable
ALTER TABLE "generated_texts" ADD COLUMN     "imageText" TEXT,
ADD COLUMN     "pieceFormat" "PieceFormat",
ADD COLUMN     "slides" JSONB;
