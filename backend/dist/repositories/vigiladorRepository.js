"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VigiladorRepository = exports.prisma = void 0;
const client_1 = require("@prisma/client");
const logger_1 = __importDefault(require("../utils/logger"));
const errorHandler_1 = require("../utils/errorHandler");
const pg_1 = require("pg");
const adapter_pg_1 = require("@prisma/adapter-pg");
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error('DATABASE_URL no configurado en .env');
}
const pool = new pg_1.Pool({ connectionString });
const adapter = new adapter_pg_1.PrismaPg(pool);
exports.prisma = new client_1.PrismaClient({
    adapter,
    log: ['query', 'info', 'warn', 'error'],
});
class VigiladorRepository {
    static async findOrCreate(legajo, nombre, puntoId) {
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
        const servicioPunto = await exports.prisma.servicioPunto.findFirst({
            where: {
                puntoId: puntoId,
            },
            include: {
                servicio: true,
            },
        });
        if (!servicioPunto || !servicioPunto.servicio) {
            logger_1.default.error({ legajo, puntoId }, '🚨 Punto escaneado no pertenece a ningún servicio configurado');
            throw new errorHandler_1.ValidationError('Punto inválido: no asignado a ningún cliente/servicio');
        }
        const countAsignaciones = await exports.prisma.servicioPunto.count({
            where: { puntoId },
        });
        if (countAsignaciones > 1) {
            logger_1.default.error({ puntoId, count: countAsignaciones }, '🚨 Punto compartido entre múltiples servicios - no permitido');
            throw new errorHandler_1.ValidationError('Error de configuración: punto asignado a múltiples clientes');
        }
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
    static async getEstado(legajo) {
        const vigilador = await exports.prisma.vigilador.findUnique({
            where: { legajo },
        });
        return vigilador;
    }
    static async updateUltimoPunto(legajo, punto, activa = true) {
        await exports.prisma.vigilador.update({
            where: { legajo },
            data: {
                ultimoPunto: punto,
                rondaActiva: activa,
            },
        });
    }
    static async crearRegistro(vigiladorId, puntoId, timestamp, geo, novedades, servicioId) {
        await exports.prisma.registro.create({
            data: {
                vigiladorId,
                puntoId,
                servicioId,
                timestamp,
                geolocalizacion: geo ? JSON.stringify(geo) : null,
                novedades: novedades || null,
            },
        });
        logger_1.default.info({ vigiladorId, puntoId, servicioId, timestamp }, '📝 Registro creado exitosamente');
    }
    static async findByLegajoWithPuntos(legajo) {
        return await exports.prisma.vigilador.findUnique({
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
    }
    static async disconnect() {
        await exports.prisma.$disconnect();
    }
}
exports.VigiladorRepository = VigiladorRepository;
//# sourceMappingURL=vigiladorRepository.js.map