"use strict";
// src/repositories/vigiladorRepository.ts
// Capa de acceso a datos - Patrón Repository para desacoplar Prisma del negocio
// Mejores prácticas: type-safety total, normalización de data, documentación JSDoc
// Singleton Prisma exportado (DRY - evita múltiples conexiones)
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VigiladorRepository = exports.prisma = void 0;
const client_1 = require("@prisma/client");
const logger_1 = __importDefault(require("../utils/logger")); // ← Import centralizado del logger Pino
const errorHandler_1 = require("../utils/errorHandler"); // ← IMPORT CLAVE FALTANTE
// Singleton Prisma (best practice: una sola instancia por app)
exports.prisma = new client_1.PrismaClient({
    log: ['query', 'info', 'warn', 'error'], // Opcional: logging para depuración en desarrollo
});
/**
 * Repository para operaciones con Vigilador y Registro
 * Desacopla la lógica de negocio del acceso a datos (SOLID - Single Responsibility)
 */
class VigiladorRepository {
    /**
     * Busca vigilador por legajo. Si no existe, lo crea y asigna servicio basado en punto escaneado.
     * Lógica multi-servicio real 2026: infiere servicio del punto (sin "Default").
     * Type-safety estricta con Prisma generated types.
     * @param legajo Legajo único
     * @param nombre Nombre completo
     * @param puntoId ID del punto escaneado (para inferir servicio)
     * @returns VigiladorEstado con servicio asignado
     */
    static async findOrCreate(legajo, nombre, puntoId) {
        // 1. Buscar vigilador existente
        const vigiladorExistente = await exports.prisma.vigilador.findUnique({
            where: { legajo },
            include: { servicio: true },
        });
        if (vigiladorExistente) {
            logger_1.default.debug({ legajo, servicio: vigiladorExistente.servicio.nombre }, '🔍 Vigilador existente encontrado');
            return {
                id: vigiladorExistente.id,
                nombre: vigiladorExistente.nombre,
                legajo: vigiladorExistente.legajo,
                ultimoPunto: vigiladorExistente.ultimoPunto,
                rondaActiva: vigiladorExistente.rondaActiva,
            };
        }
        // 2. Inferir servicio desde el punto escaneado (puntos exclusivos por diseño actual)
        const servicioPunto = await exports.prisma.servicioPunto.findFirst({
            where: {
                puntoId: puntoId,
            },
            include: {
                servicio: true, // ← Trae datos del servicio relacionado
            },
        });
        if (!servicioPunto || !servicioPunto.servicio) {
            logger_1.default.error({ legajo, puntoId }, '🚨 Punto escaneado no pertenece a ningún servicio configurado');
            throw new errorHandler_1.ValidationError('Punto inválido: no asignado a ningún cliente/servicio');
        }
        // Validación adicional (escalable para futuro con compartidos)
        const countAsignaciones = await exports.prisma.servicioPunto.count({
            where: { puntoId },
        });
        if (countAsignaciones > 1) {
            logger_1.default.error({ puntoId, count: countAsignaciones }, '🚨 Punto compartido entre múltiples servicios - no permitido');
            throw new errorHandler_1.ValidationError('Error de configuración: punto asignado a múltiples clientes');
        }
        // 3. Crear nuevo vigilador con servicio inferido
        const nuevoVigilador = await exports.prisma.vigilador.create({
            data: {
                nombre: nombre.trim(),
                legajo,
                servicioId: servicioPunto.servicio.id,
                ultimoPunto: 0,
                rondaActiva: false,
            },
            include: { servicio: true },
        });
        logger_1.default.info({
            legajo,
            nombre: nuevoVigilador.nombre,
            servicio: servicioPunto.servicio.nombre,
            puntoId,
        }, '🆕 Nuevo vigilador creado y asignado automáticamente al servicio correcto');
        return {
            id: nuevoVigilador.id,
            nombre: nuevoVigilador.nombre,
            legajo: nuevoVigilador.legajo,
            ultimoPunto: nuevoVigilador.ultimoPunto,
            rondaActiva: nuevoVigilador.rondaActiva,
        };
    }
    /**
     * Obtiene el estado actual del vigilador
     * @param legajo - Legajo del vigilador
     * @returns VigiladorEstado o null si no existe
     */
    static async getEstado(legajo) {
        const vigilador = await exports.prisma.vigilador.findUnique({
            where: { legajo },
        });
        return vigilador;
    }
    /**
     * Actualiza el último punto escaneado y estado de ronda
     * @param legajo - Legajo del vigilador
     * @param punto - Nuevo último punto
     * @param activa - Estado de ronda activa (default true)
     */
    static async updateUltimoPunto(legajo, punto, activa = true) {
        await exports.prisma.vigilador.update({
            where: { legajo },
            data: {
                ultimoPunto: punto,
                rondaActiva: activa,
            },
        });
    }
    /**
     * Crea un registro de escaneo
     * Normaliza geolocalización a string JSON
     * @param vigiladorId - ID del vigilador
     * @param puntoId - ID del punto
     * @param timestamp - Fecha y hora del escaneo
     * @param geo - Geolocalización { lat, long } o null
     * @param novedades - Texto libre del vigilador (normalizado)
     * @param servicioId - ID del servicio asociado (obligatorio en multi-servicio)
     */
    static async crearRegistro(vigiladorId, puntoId, timestamp, geo, novedades, servicioId) {
        await exports.prisma.registro.create({
            data: {
                vigiladorId,
                puntoId,
                servicioId, // ← Ahora se usa correctamente
                timestamp,
                geolocalizacion: geo ? JSON.stringify(geo) : null,
                novedades: novedades || null,
            },
        });
        logger_1.default.info({ vigiladorId, puntoId, servicioId, timestamp }, '📝 Registro creado exitosamente');
    }
    /**
     * Obtiene el vigilador completo con sus puntos ordenados por ID (secuencia natural)
     * @param legajo Legajo del vigilador
     * @returns Vigilador con servicio y lista ordenada de puntos asignados
     */
    static async findByLegajoWithPuntos(legajo) {
        return await exports.prisma.vigilador.findUnique({
            where: { legajo },
            include: {
                servicio: {
                    include: {
                        puntos: {
                            include: { punto: true },
                            orderBy: { punto: { id: 'asc' } }, // Secuencia estricta por ID ascendente
                        },
                    },
                },
            },
        });
    }
    /**
     * Cierra la conexión Prisma al finalizar la app (best practice)
     */
    static async disconnect() {
        await exports.prisma.$disconnect();
    }
}
exports.VigiladorRepository = VigiladorRepository;
//# sourceMappingURL=vigiladorRepository.js.map