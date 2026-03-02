/*
  Warnings:

  - You are about to drop the column `currentPrice` on the `Investment` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Investment" DROP COLUMN "currentPrice",
ADD COLUMN     "profit" DOUBLE PRECISION NOT NULL DEFAULT 0;
