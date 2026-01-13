"use strict";
// src/routes/adminRoutes.ts
// Rutas administrativas protegidas con JWT + rol ADMIN
// Mejores prácticas 2026: Tipado estricto, transacciones atómicas, logging estructurado, validación Zod runtime
// Normalización: Trim en nombres, validación UUID en IDs futuros
// Seguridad: Role-based access, manejo idempotente con upsert
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const vigiladorRepository_1 = require("../repositories/vigiladorRepository");
const zod_1 = require("zod");
const logger_1 = __importDefault(require("../utils/logger"));
const errorHandler_1 = require("../utils/errorHandler");
const library_1 = require("@prisma/client/runtime/library"); // Para errores específicos
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = (0, express_1.Router)();
// Protección: solo usuarios con rol ADMIN
const requireAdmin = (0, authMiddleware_1.requireAuth)(['ADMIN']);
// ── Asignar servicio a vigilador ──────────────────────────────────────────────
const AsignarServicioSchema = zod_1.z.object({
    legajo: zod_1.z.number().int().positive('Legajo debe ser positivo'),
    servicioNombre: zod_1.z.string().min(3, 'Nombre del servicio muy corto').max(100),
});
/**
 * Asigna un servicio a un vigilador por legajo.
 * @route POST /vigilador/asignar-servicio
 * @access Admin only
 */
router.post('/vigilador/asignar-servicio', requireAdmin, async (req, res) => {
    try {
        const { legajo, servicioNombre } = AsignarServicioSchema.parse(req.body);
        const servicio = await vigiladorRepository_1.prisma.servicio.findUnique({
            where: { nombre: servicioNombre.trim() }, // Normalización: trim para consistencia
        });
        if (!servicio) {
            throw new errorHandler_1.ValidationError(`Servicio "${servicioNombre}" no existe`);
        }
        const vigilador = await vigiladorRepository_1.prisma.vigilador.update({
            where: { legajo },
            data: {
                servicioId: servicio.id,
                ultimoPunto: 0,
                rondaActiva: false,
            },
            include: { servicio: { select: { nombre: true } } },
        });
        logger_1.default.info({
            adminEmail: req.user?.email,
            legajo,
            servicio: servicio.nombre,
        }, 'Servicio asignado por administrador');
        res.json({
            success: true,
            mensaje: `Servicio ${servicio.nombre} asignado al legajo ${legajo}`,
            vigilador: {
                legajo: vigilador.legajo,
                servicio: vigilador.servicio.nombre,
            },
        });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            return res.status(400).json({
                error: 'Datos inválidos',
                details: err.errors.map(e => ({ field: e.path.join('.'), message: e.message })),
            });
        }
        if (err instanceof errorHandler_1.ValidationError) {
            return res.status(400).json({ error: err.message });
        }
        if (err instanceof library_1.PrismaClientKnownRequestError && err.code === 'P2025') {
            return res.status(404).json({ error: 'Vigilador o servicio no encontrado' });
        }
        logger_1.default.error({ err, body: req.body, admin: req.user?.email }, 'Error crítico en asignación de servicio');
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});
// ── Listado de vigiladores ────────────────────────────────────────────────────
/**
 * Lista todos los vigiladores con info básica.
 * @route GET /vigiladores
 * @access Admin only
 */
router.get('/vigiladores', requireAdmin, async (req, res) => {
    try {
        const vigiladores = await vigiladorRepository_1.prisma.vigilador.findMany({
            select: {
                id: true,
                legajo: true,
                nombre: true,
                ultimoPunto: true,
                rondaActiva: true,
                servicio: { select: { nombre: true } },
            },
            orderBy: { legajo: 'asc' },
        });
        res.json({
            success: true,
            vigiladores,
            total: vigiladores.length,
            requestedBy: req.user?.email,
        });
    }
    catch (err) {
        logger_1.default.error({ err, admin: req.user?.email }, 'Error listando vigiladores');
        res.status(500).json({ error: 'Error interno' });
    }
});
// ── Crear/actualizar servicio con puntos ──────────────────────────────────────
const CreateServicioSchema = zod_1.z.object({
    nombre: zod_1.z.string().min(3).max(100),
    puntoIds: zod_1.z.array(zod_1.z.number().int().positive()).min(1, 'Debe seleccionar al menos un punto'),
});
/**
 * Crea o actualiza un servicio con puntos asignados (idempotente).
 * @route POST /servicio
 * @access Admin only
 */
router.post('/servicio', requireAdmin, async (req, res) => {
    try {
        const { nombre, puntoIds } = CreateServicioSchema.parse(req.body);
        // Transacción atómica con tipado correcto (resuelve TS2769 y TS2339)
        const servicio = await vigiladorRepository_1.prisma.$transaction(async (tx) => {
            const nuevoServicio = await tx.servicio.upsert({
                where: { nombre: nombre.trim() }, // Normalización: trim para evitar duplicados sucios
                update: {},
                create: { nombre: nombre.trim() },
            });
            for (const puntoId of puntoIds) {
                await tx.servicioPunto.upsert({
                    where: { servicioId_puntoId: { servicioId: nuevoServicio.id, puntoId } },
                    update: {},
                    create: { servicioId: nuevoServicio.id, puntoId },
                });
            }
            return nuevoServicio;
        });
        logger_1.default.info({ admin: req.user?.email, servicioId: servicio.id, nombre: servicio.nombre, puntos: puntoIds.length }, 'Servicio creado/actualizado exitosamente');
        res.json({
            success: true,
            servicio: { id: servicio.id, nombre: servicio.nombre },
        });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            return res.status(400).json({
                error: 'Datos inválidos',
                details: err.errors,
            });
        }
        if (err instanceof library_1.PrismaClientKnownRequestError) {
            if (err.code === 'P2002')
                return res.status(409).json({ error: 'Servicio duplicado' });
            if (err.code === 'P2025')
                return res.status(404).json({ error: 'Punto no encontrado' });
        }
        logger_1.default.error({ err, body: req.body, admin: req.user?.email }, 'Error creando servicio');
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});
exports.default = router;
//# sourceMappingURL=adminRoutes.js.map