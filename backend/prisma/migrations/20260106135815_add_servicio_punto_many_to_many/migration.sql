-- CreateTable
CREATE TABLE "servicio_punto" (
    "servicioId" TEXT NOT NULL,
    "puntoId" INTEGER NOT NULL,

    CONSTRAINT "servicio_punto_pkey" PRIMARY KEY ("servicioId","puntoId")
);

-- AddForeignKey
ALTER TABLE "servicio_punto" ADD CONSTRAINT "servicio_punto_servicioId_fkey" FOREIGN KEY ("servicioId") REFERENCES "servicio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servicio_punto" ADD CONSTRAINT "servicio_punto_puntoId_fkey" FOREIGN KEY ("puntoId") REFERENCES "punto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
