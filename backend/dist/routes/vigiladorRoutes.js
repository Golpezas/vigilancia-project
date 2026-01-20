"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const vigiladorController_1 = require("../controllers/vigiladorController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const vigiladorRepository_1 = require("../repositories/vigiladorRepository");
const zod_1 = require("zod");
const router = (0, express_1.Router)();
router.post('/submit', vigiladorController_1.VigiladorController.submit);
router.get('/estado/:legajo', vigiladorController_1.VigiladorController.getEstado);
router.get('/estado/:legajo', (0, authMiddleware_1.requireAuth)(['ADMIN', 'CLIENT']), vigiladorController_1.VigiladorController.getEstado);
const BatchSchema = zod_1.z.object({
    registros: zod_1.z.array(zod_1.z.object({
        uuid: zod_1.z.string().uuid(),
        nombre: zod_1.z.string().min(1).trim(),
        legajo: zod_1.z.number().int().positive(),
        punto: zod_1.z.number().int().min(1).max(20),
        novedades: zod_1.z.string().optional().transform(val => val?.trim() ?? null),
        timestamp: zod_1.z.string().datetime({ offset: true }).transform(val => new Date(val)),
        geo: zod_1.z.object({
            lat: zod_1.z.number().nullable(),
            long: zod_1.z.number().nullable(),
        }).optional().nullable(),
    })).min(1, 'Debe enviar al menos un registro'),
});
router.post('/submit-batch', (async (req, res) => {
    try {
        const { registros } = BatchSchema.parse(req.body);
        const syncedUuids = [];
        await vigiladorRepository_1.prisma.$transaction(async (tx) => {
            for (const reg of registros) {
                const existing = await tx.registro.findUnique({
                    where: { uuid: reg.uuid },
                });
                if (existing) {
                    syncedUuids.push(reg.uuid);
                    continue;
                }
                const vigilador = await tx.vigilador.findUnique({
                    where: { legajo: reg.legajo },
                    select: { id: true, servicioId: true },
                });
                if (!vigilador) {
                    throw new Error(`Vigilador con legajo ${reg.legajo} no encontrado`);
                }
                await tx.registro.create({
                    data: {
                        vigilador: { connect: { id: vigilador.id } },
                        punto: { connect: { id: reg.punto } },
                        servicio: { connect: { id: vigilador.servicioId } },
                        timestamp: reg.timestamp,
                        geolocalizacion: reg.geo ? JSON.stringify(reg.geo) : null,
                        novedades: reg.novedades,
                        uuid: reg.uuid,
                    },
                });
                syncedUuids.push(reg.uuid);
            }
        });
        return res.status(200).json({
            success: true,
            syncedUuids,
            message: `Procesados ${syncedUuids.length} registros (algunos posiblemente duplicados)`,
        });
    }
    catch (err) {
        console.error('[SUBMIT-BATCH ERROR]', {
            message: err.message,
            stack: err.stack,
            body: req.body,
        });
        const status = err instanceof zod_1.z.ZodError ? 400 : 500;
        return res.status(status).json({
            success: false,
            error: err.message || 'Error interno al procesar batch de registros',
        });
    }
}));
exports.default = router;
//# sourceMappingURL=vigiladorRoutes.js.map