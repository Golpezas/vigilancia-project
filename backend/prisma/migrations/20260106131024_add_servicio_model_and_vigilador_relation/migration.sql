/*
  Warnings:

  - Added the required column `servicioId` to the `vigilador` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "punto" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "registro" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "vigilador" ADD COLUMN     "servicioId" TEXT NOT NULL,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "servicio" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "servicio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "servicio_nombre_key" ON "servicio"("nombre");

-- AddForeignKey
ALTER TABLE "vigilador" ADD CONSTRAINT "vigilador_servicioId_fkey" FOREIGN KEY ("servicioId") REFERENCES "servicio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
