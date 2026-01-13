"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VigiladorService = void 0;
const vigiladorRepository_1 = require("../repositories/vigiladorRepository");
const normalizer_1 = require("../utils/normalizer");
const dateUtils_1 = require("../utils/dateUtils");
const errorHandler_1 = require("../utils/errorHandler");
const logger_1 = __importDefault(require("../utils/logger"));
class VigiladorService {
    static async procesarEscaneo(data) {
        const { nombre, legajo, punto, novedades, timestamp, geo } = data;
        const vigilador = await vigiladorRepository_1.VigiladorRepository.findOrCreate(legajo, nombre.trim(), punto);
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
        if (vigiladorCompleto.rondaActiva === false && vigiladorCompleto.ultimoPunto === 0) {
            if (serviciosConPunto.length === 0) {
                logger_1.default.warn({ legajo, punto }, 'Punto no asignado a ningún servicio');
                throw new errorHandler_1.ValidationError('Este punto no está asignado a ningún cliente');
            }
            if (serviciosConPunto.length > 1) {
                const nombres = serviciosConPunto.map((s) => s.nombre).join(', ');
                logger_1.default.warn({ legajo, punto, servicios: nombres }, 'Punto compartido entre múltiples servicios');
                throw new errorHandler_1.ForbiddenError(`Este punto pertenece a varios clientes: ${nombres}. Contacta al administrador.`);
            }
            servicioAsignado = serviciosConPunto[0];
            puntosDelServicio = servicioAsignado.puntos.map((sp) => sp.punto);
            await vigiladorRepository_1.prisma.$transaction([
                vigiladorRepository_1.prisma.vigilador.update({
                    where: { legajo },
                    data: { servicioId: servicioAsignado.id },
                }),
            ]);
            logger_1.default.info({ legajo, servicio: servicioAsignado.nombre, punto }, '✅ Servicio asignado automáticamente al iniciar ronda');
        }
        else {
            if (!vigiladorCompleto.servicio) {
                throw new errorHandler_1.ValidationError('Error interno: ronda activa sin servicio asignado');
            }
            servicioAsignado = vigiladorCompleto.servicio;
            puntosDelServicio = servicioAsignado.puntos.map((sp) => sp.punto);
            const puntoValido = puntosDelServicio.find(p => p.id === punto);
            if (!puntoValido) {
                logger_1.default.warn({ legajo, punto, servicio: servicioAsignado.nombre }, 'Punto no pertenece al servicio activo');
                throw new errorHandler_1.ValidationError(`Este punto no pertenece a tu ronda (${servicioAsignado.nombre}). Inicia una nueva ronda.`);
            }
        }
        const posicionActual = vigiladorCompleto.ultimoPunto;
        const totalPuntos = puntosDelServicio.length;
        if (posicionActual === 0) {
            if (punto !== puntosDelServicio[0].id) {
                const primerPunto = puntosDelServicio[0];
                throw new errorHandler_1.ValidationError(`Inicia la ronda por el punto ${primerPunto.id} (${primerPunto.nombre})`);
            }
        }
        else {
            const siguiente = puntosDelServicio[posicionActual].id;
            if (punto !== siguiente) {
                const esperado = puntosDelServicio[posicionActual];
                throw new errorHandler_1.ValidationError(`Debes escanear el punto siguiente: ${esperado.id} (${esperado.nombre})`);
            }
        }
        const geoNormalizado = (0, normalizer_1.normalizeGeo)(geo);
        const novedadesNormalizadas = (0, normalizer_1.normalizeNovedades)(novedades);
        await vigiladorRepository_1.prisma.$transaction(async (tx) => {
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
            const nuevoProgreso = posicionActual + 1;
            if (nuevoProgreso === totalPuntos) {
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
                await tx.vigilador.update({
                    where: { legajo },
                    data: {
                        ultimoPunto: nuevoProgreso,
                        rondaActiva: true,
                    },
                });
            }
        });
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
    static async getVigiladoresPorServicio(servicioNombre) {
        if (!servicioNombre.trim()) {
            logger_1.default.warn({ servicioNombre }, '⚠️ Nombre de servicio inválido');
            throw new errorHandler_1.ValidationError('Nombre de servicio requerido');
        }
        const servicio = await vigiladorRepository_1.prisma.servicio.findUnique({
            where: { nombre: servicioNombre },
            include: {
                vigiladores: {
                    include: {
                        servicio: { include: { puntos: true } },
                    },
                },
            },
        });
        if (!servicio) {
            logger_1.default.info({ servicioNombre }, '🔍 Servicio no encontrado');
            throw new errorHandler_1.NotFoundError('Servicio no encontrado');
        }
        const vigiladoresExtendidos = servicio.vigiladores.map((vigilador) => {
            const totalPuntos = vigilador.servicio.puntos.length;
            const progreso = totalPuntos > 0 ? Math.round((vigilador.ultimoPunto / totalPuntos) * 100) : 0;
            return {
                ...vigilador,
                progreso,
                servicioNombre: vigilador.servicio.nombre,
                ultimoTimestamp: vigilador.updatedAt ? (0, dateUtils_1.toArgentinaTime)(vigilador.updatedAt) : null,
            };
        });
        logger_1.default.info({ servicioNombre, count: vigiladoresExtendidos.length }, '✅ Vigiladores por servicio obtenidos');
        return vigiladoresExtendidos;
    }
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
            ultimoTimestamp: vigilador.updatedAt ? (0, dateUtils_1.toArgentinaTime)(vigilador.updatedAt) : null,
        };
        logger_1.default.debug({ legajo, progreso, servicio: vigilador.servicio.nombre }, '✅ Estado calculado exitosamente');
        return estadoNormalizado;
    }
}
exports.VigiladorService = VigiladorService;
//# sourceMappingURL=vigiladorService.js.map