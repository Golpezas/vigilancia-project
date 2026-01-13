"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/app.ts
const express_1 = __importDefault(require("express")); // Type-safety explícito
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const vigiladorRoutes_1 = __importDefault(require("./routes/vigiladorRoutes"));
const errorHandler_1 = require("./utils/errorHandler");
const logger_1 = __importDefault(require("./utils/logger")); // Logger centralizado Pino
const adminRoutes_1 = __importDefault(require("./routes/adminRoutes"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const app = (0, express_1.default)();
// Puerto normalizado con fallback seguro
const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
// Middlewares (seguridad + parsing escalable)
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: '*', // TODO: Restringir en prod a dominios específicos
    credentials: true
}));
app.use(express_1.default.json({ limit: '10mb' }));
// Rutas desacopladas
app.use('/api', vigiladorRoutes_1.default);
app.use('/api/auth', authRoutes_1.default);
app.use('/api/admin', adminRoutes_1.default); // ← Nueva ruta protegida
// Health check con logging estructurado
app.get('/', (req, res) => {
    const response = {
        message: 'API Vigilancia QR - Backend corriendo correctamente',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    };
    // ← Orden correcto: objeto primero (mergeado en log), mensaje segundo
    logger_1.default.info({ response }, '🔍 Health check accedido');
    res.json(response);
});
// Handler global de errores (centralizado + structured)
app.use((err, req, res, next) => {
    const context = {
        path: req.path,
        method: req.method,
        body: req.body,
        query: req.query,
        errorMessage: err instanceof Error ? err.message : 'Error desconocido',
        stack: err instanceof Error ? err.stack : undefined,
    };
    // Usa child logger para context adicional (best practice Pino: no sobreescribir global)
    const errorLogger = logger_1.default.child({ reqId: req.headers['x-request-id'] || 'unknown' }); // Opcional reqId para traceability
    errorLogger.error(context, '🚨 Error global no manejado');
    let status = 500;
    let message = 'Error interno del servidor';
    if (err instanceof errorHandler_1.AppError) {
        status = err.statusCode;
        message = err.message;
    }
    else if (err instanceof Error) {
        // Fallback para errores genéricos (normalización)
        message = err.message;
    }
    res.status(status).json({ error: message });
});
// 404 handler
app.use('*', (req, res) => {
    // ← Objeto primero
    logger_1.default.warn({ path: req.path, method: req.method }, '⚠️ Ruta no encontrada');
    res.status(404).json({
        error: 'Ruta no encontrada'
    });
});
// Startup con logging
app.listen(PORT, '0.0.0.0', () => {
    logger_1.default.info({ port: PORT }, '🚀 Servidor backend corriendo en puerto');
    if (process.env.NODE_ENV !== 'production') {
        logger_1.default.debug({ url: `http://localhost:${PORT}` }, '🔗 Acceso local');
    }
});
exports.default = app;
//# sourceMappingURL=app.js.map