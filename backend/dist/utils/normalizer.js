"use strict";
// src/utils/normalizer.ts
// Funciones para normalización de datos - Aplicando mejores prácticas DRY y consistencia
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeoSchema = void 0;
exports.normalizeGeo = normalizeGeo;
exports.normalizeString = normalizeString;
exports.normalizeNovedades = normalizeNovedades;
const zod_1 = require("zod");
/**
 * Esquema Zod para geolocalización.
 * Permite valores nulos (cuando el usuario deniega permiso).
 */
exports.GeoSchema = zod_1.z.object({
    lat: zod_1.z.number().min(-90).max(90).nullable().optional(),
    long: zod_1.z.number().min(-180).max(180).nullable().optional(),
});
/**
 * Normaliza y valida coordenadas geográficas.
 * @param geo Datos crudos de geolocalización
 * @returns Objeto normalizado o null si es inválido
 */
function normalizeGeo(geo) {
    const result = exports.GeoSchema.safeParse(geo);
    if (!result.success) {
        return null;
    }
    return {
        lat: result.data.lat ?? null,
        long: result.data.long ?? null,
    };
}
/**
 * Normaliza strings: elimina espacios y unifica formato.
 * @param str String de entrada
 * @returns String normalizado
 */
function normalizeString(str) {
    if (!str)
        return '';
    return str.trim().toLowerCase();
}
/**
 * Normaliza novedades (texto libre del vigilador)
 * @param novedades Texto ingresado
 * @returns Texto limpio y seguro
 */
function normalizeNovedades(novedades) {
    return normalizeString(novedades);
}
//# sourceMappingURL=normalizer.js.map