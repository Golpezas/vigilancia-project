-- CreateTable
CREATE TABLE "vigilador" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "legajo" INTEGER NOT NULL,
    "ultimoPunto" INTEGER NOT NULL DEFAULT 0,
    "rondaActiva" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "vigilador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "punto" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "punto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registro" (
    "id" TEXT NOT NULL,
    "vigiladorId" TEXT NOT NULL,
    "puntoId" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "geolocalizacion" TEXT,
    "novedades" TEXT,

    CONSTRAINT "registro_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vigilador_legajo_key" ON "vigilador"("legajo");

-- CreateIndex
CREATE UNIQUE INDEX "punto_nombre_key" ON "punto"("nombre");

-- CreateIndex
CREATE INDEX "registro_vigiladorId_timestamp_idx" ON "registro"("vigiladorId", "timestamp");

-- AddForeignKey
ALTER TABLE "registro" ADD CONSTRAINT "registro_vigiladorId_fkey" FOREIGN KEY ("vigiladorId") REFERENCES "vigilador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registro" ADD CONSTRAINT "registro_puntoId_fkey" FOREIGN KEY ("puntoId") REFERENCES "punto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
