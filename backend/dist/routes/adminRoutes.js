"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const vigiladorRepository_1 = require("../repositories/vigiladorRepository");
const zod_1 = require("zod");
const logger_1 = __importDefault(require("../utils/logger"));
const errorHandler_1 = require("../utils/errorHandler");
const authMiddleware_1 = require("../middlewares/authMiddleware");
function isPrismaKnownRequestError(err) {
    return (err != null &&
        typeof err === 'object' &&
        'code' in err &&
        typeof err.code === 'string' &&
        err.code.startsWith('P'));
}
const router = (0, express_1.Router)();
const requireAdmin = (0, authMiddleware_1.requireAuth)(['ADMIN']);
const AsignarServicioSchema = zod_1.z.object({
    legajo: zod_1.z.number().int().positive('Legajo debe ser positivo'),
    servicioNombre: zod_1.z.string().min(3, 'Nombre del servicio muy corto').max(100),
});
router.post('/vigilador/asignar-servicio', requireAdmin, async (req, res) => {
    try {
        const { legajo, servicioNombre } = AsignarServicioSchema.parse(req.body);
        const servicio = await vigiladorRepository_1.prisma.servicio.findUnique({
            where: { nombre: servicioNombre.trim() },
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
        if (isPrismaKnownRequestError(err) && err.code === 'P2025') {
            logger_1.default.warn({ code: err.code, meta: err.meta }, 'Recurso no encontrado (P2025)');
            return res.status(404).json({ error: 'Vigilador o servicio no encontrado' });
        }
        logger_1.default.error({ err, body: req.body, admin: req.user?.email }, 'Error crítico en asignación de servicio');
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});
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
const CreateServicioSchema = zod_1.z.object({
    nombre: zod_1.z.string().min(3).max(100),
    puntoIds: zod_1.z.array(zod_1.z.number().int().positive()).min(1, 'Debe seleccionar al menos un punto'),
});
router.post('/crear-servicio', requireAdmin, async (req, res) => {
    try {
        const parsed = CreateServicioSchema.parse(req.body);
        logger_1.default.info({ admin: req.user?.email, nombre: parsed.nombre, puntos: parsed.puntoIds.length }, '📥 Intentando crear servicio');
        const servicio = await vigiladorRepository_1.prisma.$transaction(async (txClient) => {
            const nuevoServicio = await txClient.servicio.upsert({
                where: { nombre: parsed.nombre.trim() },
                update: {},
                create: { nombre: parsed.nombre.trim() },
            });
            for (const puntoId of parsed.puntoIds) {
                await txClient.servicioPunto.upsert({
                    where: { servicioId_puntoId: { servicioId: nuevoServicio.id, puntoId } },
                    update: {},
                    create: { servicioId: nuevoServicio.id, puntoId },
                });
            }
            return nuevoServicio;
        });
        logger_1.default.info({ admin: req.user?.email, servicioId: servicio.id }, '✅ Servicio creado');
        res.json({ success: true, servicio: { id: servicio.id, nombre: servicio.nombre } });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            logger_1.default.warn({ issues: err.issues, admin: req.user?.email }, '⚠️ Datos inválidos en crear-servicio');
            return res.status(400).json({ error: 'Datos inválidos', details: err.errors });
        }
        if (isPrismaKnownRequestError(err)) {
            logger_1.default.error({ code: err.code, meta: err.meta, admin: req.user?.email }, '🚨 Error Prisma conocido en crear-servicio');
            if (err.code === 'P2002') {
                return res.status(409).json({ error: 'El nombre del servicio ya existe (conflicto de unicidad)' });
            }
            if (err.code === 'P2025') {
                return res.status(404).json({ error: 'Recurso relacionado no encontrado' });
            }
            return res.status(400).json({ error: `Error de base de datos: ${err.code}` });
        }
        logger_1.default.error({ err, admin: req.user?.email }, '❌ Error inesperado en crear-servicio');
        res.status(500).json({ error: 'Error interno' });
    }
});
router.get('/puntos', requireAdmin, async (req, res, next) => {
    try {
        const puntos = await vigiladorRepository_1.prisma.punto.findMany({
            select: {
                id: true,
                nombre: true,
            },
            orderBy: { id: 'asc' },
        });
        const outputSchema = zod_1.z.array(zod_1.z.object({
            id: zod_1.z.number().int().positive(),
            nombre: zod_1.z.string().min(1),
        }));
        const parsed = outputSchema.safeParse(puntos);
        if (!parsed.success) {
            logger_1.default.warn({ issues: parsed.error.issues, admin: req.user?.email }, '⚠️ Datos de puntos inválidos en DB');
            throw new errorHandler_1.ValidationError('Datos de puntos inconsistentes');
        }
        logger_1.default.info({
            adminEmail: req.user?.email,
            count: parsed.data.length,
            path: req.path,
        }, '✅ Lista de puntos devuelta exitosamente');
        res.json(parsed.data);
    }
    catch (err) {
        next(err);
    }
});
router.get('/servicios', requireAdmin, async (req, res, next) => {
    try {
        const servicios = await vigiladorRepository_1.prisma.servicio.findMany({
            select: {
                id: true,
                nombre: true,
            },
            orderBy: { nombre: 'asc' },
        });
        const outputSchema = zod_1.z.array(zod_1.z.object({
            id: zod_1.z.string().uuid(),
            nombre: zod_1.z.string().min(1),
        }));
        const parsed = outputSchema.safeParse(servicios);
        if (!parsed.success) {
            logger_1.default.warn({ issues: parsed.error.issues, admin: req.user?.email }, '⚠️ Datos de servicios inválidos');
            throw new errorHandler_1.ValidationError('Datos de servicios inconsistentes');
        }
        logger_1.default.info({
            adminEmail: req.user?.email,
            count: parsed.data.length,
            path: req.path,
        }, '✅ Lista de servicios devuelta');
        res.json(parsed.data);
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=adminRoutes.js.map