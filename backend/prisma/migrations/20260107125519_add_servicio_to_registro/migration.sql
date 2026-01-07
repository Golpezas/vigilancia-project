/*
  Warnings:

  - Added the required column `servicioId` to the `registro` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "registro" ADD COLUMN     "servicioId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "registro_servicioId_idx" ON "registro"("servicioId");

-- AddForeignKey
ALTER TABLE "registro" ADD CONSTRAINT "registro_servicioId_fkey" FOREIGN KEY ("servicioId") REFERENCES "servicio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
