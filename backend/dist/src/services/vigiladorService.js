"use strict";
// src/services/vigiladorService.ts
// Lógica de negocio principal - Validación secuencial dinámica por servicio
// Mejores prácticas 2026: Asignación automática de servicio al iniciar ronda
// Type-safety estricta, early validation, logging Pino estructurado, JSDoc completo
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VigiladorService = void 0;
// src/services/vigiladorService.ts
const vigiladorRepository_1 = require("../repositories/vigiladorRepository");
// Utilidades de normalización y formateo
const normalizer_1 = require("../utils/normalizer");
const dateUtils_1 = require("../utils/dateUtils");
// Manejo de errores custom (AppError family)
const errorHandler_1 = require("../utils/errorHandler");
const logger_1 = __importDefault(require("../utils/logger"));
class VigiladorService {
    /**
     * Procesa el escaneo de un punto QR.
     * Valida secuencia estricta basada en los puntos asignados al servicio del vigilador.
     * Asigna automáticamente el servicio al iniciar una ronda.
     * @param data Datos validados desde controller
     * @returns Respuesta normalizada para frontend
     */
    static async procesarEscaneo(data) {
        const { nombre, legajo, punto, novedades, timestamp, geo } = data;
        // 1. Buscar o crear vigilador (sin servicio preasignado)
        const vigilador = await vigiladorRepository_1.VigiladorRepository.findOrCreate(legajo, nombre.trim(), punto);
        // 2. Cargar datos completos (incluye servicio si ya está asignado)
        const vigiladorCompleto = await vigiladorRepository_1.prisma.vigilador.findUnique({
            where: { legajo },
            include: {
                servicio: {
                    include: {
                        puntos: {
                            include: { punto: true },
                            orderBy: { punto: { id: 'asc' } },
                        },
                    },
                },
            },
        });
        if (!vigiladorCompleto) {
            throw new errorHandler_1.ValidationError('Vigilador no encontrado');
        }
        // 3. Buscar servicios que incluyen este punto
        const serviciosConPunto = await vigiladorRepository_1.prisma.servicio.findMany({
            where: {
                puntos: {
                    some: { puntoId: punto },
                },
            },
            include: {
                puntos: {
                    include: { punto: true },
                    orderBy: { punto: { id: 'asc' } },
                },
            },
        });
        let servicioAsignado;
        let puntosDelServicio = [];
        // 4. Lógica de asignación o validación del servicio
        if (vigiladorCompleto.rondaActiva === false && vigiladorCompleto.ultimoPunto === 0) {
            // PRIMER ESCANEO → ASIGNAR SERVICIO AUTOMÁTICAMENTE
            if (serviciosConPunto.length === 0) {
                logger_1.default.warn({ legajo, punto }, 'Punto no asignado a ningún servicio');
                throw new errorHandler_1.ValidationError('Este punto no está asignado a ningún cliente');
            }
            if (serviciosConPunto.length > 1) {
                const nombres = serviciosConPunto.map(s => s.nombre).join(', ');
                logger_1.default.warn({ legajo, punto, servicios: nombres }, 'Punto compartido entre múltiples servicios');
                throw new errorHandler_1.ForbiddenError(`Este punto pertenece a varios clientes: ${nombres}. Contacta al administrador.`);
            }
            // ✅ Asignar el único servicio encontrado
            servicioAsignado = serviciosConPunto[0];
            puntosDelServicio = servicioAsignado.puntos.map(sp => sp.punto);
            // Actualizar vigilador con servicio (en transacción)
            await vigiladorRepository_1.prisma.$transaction([
                vigiladorRepository_1.prisma.vigilador.update({
                    where: { legajo },
                    data: { servicioId: servicioAsignado.id },
                }),
            ]);
            logger_1.default.info({ legajo, servicio: servicioAsignado.nombre, punto }, '✅ Servicio asignado automáticamente al iniciar ronda');
        }
        else {
            // ESCANEO EN RONDA ACTIVA → VALIDAR SERVICIO ACTUAL
            if (!vigiladorCompleto.servicio) {
                // Estado inconsistente: ronda activa pero sin servicio
                throw new errorHandler_1.ValidationError('Error interno: ronda activa sin servicio asignado');
            }
            servicioAsignado = vigiladorCompleto.servicio;
            puntosDelServicio = servicioAsignado.puntos.map(sp => sp.punto);
            // Validar que el punto pertenezca al servicio actual
            const puntoValido = puntosDelServicio.find(p => p.id === punto);
            if (!puntoValido) {
                logger_1.default.warn({ legajo, punto, servicio: servicioAsignado.nombre }, 'Punto no pertenece al servicio activo');
                throw new errorHandler_1.ValidationError(`Este punto no pertenece a tu ronda (${servicioAsignado.nombre}). Inicia una nueva ronda.`);
            }
        }
        // 5. Validación de secuencia
        const posicionActual = vigiladorCompleto.ultimoPunto;
        const totalPuntos = puntosDelServicio.length;
        if (posicionActual === 0) {
            // Primera ronda: debe empezar por el primer punto
            if (punto !== puntosDelServicio[0].id) {
                const primerPunto = puntosDelServicio[0];
                throw new errorHandler_1.ValidationError(`Inicia la ronda por el punto ${primerPunto.id} (${primerPunto.nombre})`);
            }
        }
        else {
            // Siguiente punto esperado
            const siguiente = puntosDelServicio[posicionActual].id;
            if (punto !== siguiente) {
                const esperado = puntosDelServicio[posicionActual];
                throw new errorHandler_1.ValidationError(`Debes escanear el punto siguiente: ${esperado.id} (${esperado.nombre})`);
            }
        }
        // 6. Normalización
        const geoNormalizado = (0, normalizer_1.normalizeGeo)(geo);
        const novedadesNormalizadas = (0, normalizer_1.normalizeNovedades)(novedades);
        // 7. Persistencia en transacción interactiva (best practice Prisma v5+ 2026)
        // Usamos callback para atomicidad total y type-safety perfecta
        await vigiladorRepository_1.prisma.$transaction(async (tx) => {
            // Crear el registro directamente con tx (evitamos wrapper que devuelve Promise<void>)
            await tx.registro.create({
                data: {
                    vigiladorId: vigiladorCompleto.id,
                    puntoId: punto,
                    servicioId: servicioAsignado.id,
                    timestamp: new Date(timestamp),
                    geolocalizacion: geoNormalizado ? JSON.stringify(geoNormalizado) : null,
                    novedades: novedadesNormalizadas || null,
                },
            });
            // Calcular nuevo progreso
            const nuevoProgreso = posicionActual + 1;
            if (nuevoProgreso === totalPuntos) {
                // Ronda completada → resetear
                await tx.vigilador.update({
                    where: { legajo },
                    data: {
                        ultimoPunto: 0,
                        rondaActiva: false,
                    },
                });
                logger_1.default.info({ legajo, servicio: servicioAsignado.nombre }, '🔄 Ronda completada en transacción');
            }
            else {
                // Avanzar en la ronda
                await tx.vigilador.update({
                    where: { legajo },
                    data: {
                        ultimoPunto: nuevoProgreso,
                        rondaActiva: true,
                    },
                });
            }
        });
        // 8. Mensaje de respuesta (fuera de transacción)
        let mensaje;
        if (posicionActual + 1 === totalPuntos) {
            mensaje = `¡Ronda completada exitosamente! (${servicioAsignado.nombre})`;
        }
        else {
            mensaje = `Punto ${posicionActual + 1}/${totalPuntos} registrado correctamente`;
        }
        logger_1.default.info({ legajo, punto, servicio: servicioAsignado.nombre, progreso: `${posicionActual + 1}/${totalPuntos}` }, '✅ Escaneo procesado exitosamente');
        return { success: true, mensaje };
    }
    // Agregamos al export class VigiladorService
    /**
     * Obtiene el estado normalizado de un vigilador.
     * Incluye progreso en ronda (porcentaje), último punto, y detalles de servicio.
     * Logging Pino: contexto detallado para traceability.
     * @param legajo Legajo único del vigilador
     * @returns VigiladorEstado extendido con progreso y servicio info
     * @throws ValidationError si legajo inválido; NotFoundError si no existe
     */
    static async getEstado(legajo) {
        if (!Number.isInteger(legajo) || legajo <= 0) {
            logger_1.default.warn({ legajo }, '⚠️ Legajo inválido en getEstado');
            throw new errorHandler_1.ValidationError('Legajo debe ser un entero positivo');
        }
        const vigilador = await vigiladorRepository_1.VigiladorRepository.findByLegajoWithPuntos(legajo);
        if (!vigilador) {
            logger_1.default.info({ legajo }, '🔍 Vigilador no encontrado en getEstado');
            throw new errorHandler_1.NotFoundError('Vigilador no encontrado');
        }
        const totalPuntos = vigilador.servicio.puntos.length;
        const progreso = totalPuntos > 0 ? Math.round((vigilador.ultimoPunto / totalPuntos) * 100) : 0;
        const estadoNormalizado = {
            ...vigilador,
            progreso,
            servicioNombre: vigilador.servicio.nombre,
            ultimoTimestamp: vigilador.updatedAt ? (0, dateUtils_1.toArgentinaTime)(vigilador.updatedAt) : null, // Normalización timezone
        };
        logger_1.default.debug({ legajo, progreso, servicio: vigilador.servicio.nombre }, '✅ Estado calculado exitosamente');
        return estadoNormalizado;
    }
}
exports.VigiladorService = VigiladorService;
