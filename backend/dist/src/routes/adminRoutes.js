"use strict";
// src/routes/adminRoutes.ts
// Rutas administrativas - Multi-servicio robusto 2026
// Protección con API key, validación Zod estricta, logging estructurado Pino
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const vigiladorRepository_1 = require("../repositories/vigiladorRepository");
const zod_1 = require("zod");
const logger_1 = __importDefault(require("../utils/logger"));
const errorHandler_1 = require("../utils/errorHandler");
const client_1 = require("@prisma/client"); // ← IMPORT CLAVE
const router = (0, express_1.Router)();
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'dev-key-change-in-prod';
const requireAdmin = (req, res, next) => {
    const apiKey = req.headers['x-admin-key'];
    if (apiKey !== ADMIN_API_KEY) {
        logger_1.default.warn({ ip: req.ip, path: req.path, providedKey: apiKey ? 'presente' : 'ausente' }, '⚠️ Acceso admin denegado');
        return res.status(401).json({ error: 'Acceso denegado: clave API inválida' });
    }
    next();
};
// Schema para asignar servicio
const AsignarServicioSchema = zod_1.z.object({
    legajo: zod_1.z.number().int().positive('Legajo debe ser positivo'),
    servicioNombre: zod_1.z.string().min(3, 'Nombre del servicio muy corto'),
});
router.post('/vigilador/asignar-servicio', requireAdmin, async (req, res) => {
    try {
        const { legajo, servicioNombre } = AsignarServicioSchema.parse(req.body);
        const servicio = await vigiladorRepository_1.prisma.servicio.findUnique({
            where: { nombre: servicioNombre },
        });
        if (!servicio) {
            throw new errorHandler_1.ValidationError(`Servicio "${servicioNombre}" no existe`);
        }
        const vigilador = await vigiladorRepository_1.prisma.vigilador.update({
            where: { legajo },
            data: {
                servicioId: servicio.id,
                ultimoPunto: 0,
                rondaActiva: false, // Reinicia ronda al cambiar servicio
            },
            include: { servicio: true },
        });
        logger_1.default.info({ legajo, nuevoServicio: servicio.nombre, vigiladorId: vigilador.id }, '✅ Servicio asignado manualmente a vigilador');
        res.json({
            success: true,
            mensaje: `Servicio "${servicio.nombre}" asignado al legajo ${legajo}`,
            vigilador: {
                legajo: vigilador.legajo,
                nombre: vigilador.nombre,
                servicio: vigilador.servicio.nombre,
            },
        });
    }
    catch (err) {
        // 1. Errores de validación Zod
        if (err instanceof zod_1.z.ZodError) {
            logger_1.default.warn({ body: req.body, errors: err.errors }, 'Datos inválidos en asignación de servicio');
            return res.status(400).json({
                error: 'Datos inválidos',
                details: err.errors.map(e => ({
                    campo: e.path.join('.'),
                    mensaje: e.message,
                })),
            });
        }
        // 2. Nuestros errores personalizados
        if (err instanceof errorHandler_1.ValidationError) {
            logger_1.default.warn({ body: req.body, message: err.message }, 'Validación fallida');
            return res.status(400).json({ error: err.message });
        }
        // 3. Errores conocidos de Prisma (P2025 = registro no encontrado en update)
        if (err instanceof client_1.Prisma.PrismaClientKnownRequestError) {
            if (err.code === 'P2025') {
                logger_1.default.warn({ legajo: req.body.legajo }, 'Vigilador no encontrado al asignar servicio');
                return res.status(404).json({ error: 'Vigilador no encontrado' });
            }
        }
        // 4. Error inesperado
        const message = err instanceof Error ? err.message : 'Error desconocido';
        const stack = err instanceof Error ? err.stack : undefined;
        logger_1.default.error({ err, message, stack, body: req.body }, '🚨 Error inesperado en asignación de servicio');
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});
// Listar vigiladores con su servicio (útil para panel admin)
router.get('/vigiladores', requireAdmin, async (req, res) => {
    try {
        const vigiladores = await vigiladorRepository_1.prisma.vigilador.findMany({
            select: {
                id: true,
                nombre: true,
                legajo: true,
                ultimoPunto: true,
                rondaActiva: true,
                servicio: { select: { nombre: true } },
            },
            orderBy: { legajo: 'asc' },
        });
        res.json({ vigiladores });
    }
    catch (err) {
        logger_1.default.error({ err }, 'Error listando vigiladores');
        res.status(500).json({ error: 'Error interno' });
    }
});
// Schema para crear servicio (normalizado de versiones iniciales)
const CreateServicioSchema = zod_1.z.object({
    nombre: zod_1.z.string().min(3, 'Nombre muy corto').max(100),
    puntoIds: zod_1.z.array(zod_1.z.number().int().positive()).min(1, 'Al menos un punto'),
});
router.post('/servicio', requireAdmin, async (req, res) => {
    try {
        const { nombre, puntoIds } = CreateServicioSchema.parse(req.body);
        // Transacción para atomicidad (crear servicio + asignar puntos)
        const servicio = await vigiladorRepository_1.prisma.$transaction(async (tx) => {
            const nuevoServicio = await tx.servicio.upsert({
                where: { nombre },
                update: {},
                create: { nombre: nombre.trim() },
            });
            for (const puntoId of puntoIds) {
                await tx.servicioPunto.upsert({
                    where: {
                        servicioId_puntoId: {
                            servicioId: nuevoServicio.id,
                            puntoId,
                        },
                    },
                    update: {},
                    create: {
                        servicioId: nuevoServicio.id,
                        puntoId,
                    },
                });
            }
            return nuevoServicio;
        });
        logger_1.default.info({ servicioId: servicio.id, nombre: servicio.nombre, puntos: puntoIds.length }, '✅ Servicio creado/actualizado');
        res.json({
            success: true,
            servicio: {
                id: servicio.id,
                nombre: servicio.nombre,
            },
        });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            logger_1.default.warn({ body: req.body, errors: err.errors }, 'Datos inválidos en creación de servicio');
            return res.status(400).json({ error: 'Datos inválidos', details: err.errors });
        }
        const message = err instanceof Error ? err.message : 'Error desconocido';
        logger_1.default.error({ err, message, body: req.body }, '🚨 Error creando servicio');
        res.status(500).json({ error: 'Error interno' });
    }
});
exports.default = router;
