-- AlterTable
ALTER TABLE "registro" ADD COLUMN     "createdBy" TEXT;

-- CreateIndex
CREATE INDEX "registro_uuid_idx" ON "registro"("uuid");

-- CreateIndex
CREATE INDEX "registro_vigiladorId_uuid_idx" ON "registro"("vigiladorId", "uuid");
