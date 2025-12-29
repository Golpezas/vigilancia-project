-- CreateTable
CREATE TABLE "vigilador" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "legajo" INTEGER NOT NULL,
    "ultimoPunto" INTEGER NOT NULL DEFAULT 0,
    "rondaActiva" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "punto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "geo" TEXT
);

-- CreateTable
CREATE TABLE "registro" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vigiladorId" TEXT NOT NULL,
    "puntoId" INTEGER NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "geolocalizacion" TEXT,
    "novedades" TEXT,
    CONSTRAINT "registro_vigiladorId_fkey" FOREIGN KEY ("vigiladorId") REFERENCES "vigilador" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "registro_puntoId_fkey" FOREIGN KEY ("puntoId") REFERENCES "punto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "vigilador_legajo_key" ON "vigilador"("legajo");

-- CreateIndex
CREATE INDEX "registro_vigiladorId_timestamp_idx" ON "registro"("vigiladorId", "timestamp");
