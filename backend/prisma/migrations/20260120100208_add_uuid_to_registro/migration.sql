/*
  Warnings:

  - A unique constraint covering the columns `[uuid]` on the table `registro` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "registro" ADD COLUMN     "uuid" TEXT,
ALTER COLUMN "timestamp" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "registro_uuid_key" ON "registro"("uuid");
