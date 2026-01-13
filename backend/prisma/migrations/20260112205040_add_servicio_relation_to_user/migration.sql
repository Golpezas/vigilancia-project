-- AlterTable
ALTER TABLE "user" ADD COLUMN     "servicioId" TEXT,
ALTER COLUMN "role" SET DEFAULT 'CLIENT';

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_servicioId_fkey" FOREIGN KEY ("servicioId") REFERENCES "servicio"("id") ON DELETE SET NULL ON UPDATE CASCADE;
