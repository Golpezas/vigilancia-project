"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const vigiladorRoutes_1 = __importDefault(require("./routes/vigiladorRoutes"));
const errorHandler_1 = require("./utils/errorHandler");
const logger_1 = __importDefault(require("./utils/logger"));
const adminRoutes_1 = __importDefault(require("./routes/adminRoutes"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const reporteRoutes_1 = __importDefault(require("./routes/reporteRoutes"));
const app = (0, express_1.default)();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: '*',
    credentials: true
}));
app.use(express_1.default.json({ limit: '10mb' }));
app.use('/api', vigiladorRoutes_1.default);
app.use('/api/auth', authRoutes_1.default);
app.use('/api/admin', adminRoutes_1.default);
app.use('/api/reportes', reporteRoutes_1.default);
app.use('*', (req, res) => {
    logger_1.default.warn({ path: req.path, method: req.method, query: req.query }, '⚠️ Ruta no encontrada');
    res.status(404).json({ error: 'Ruta no encontrada' });
});
app.get('/', (req, res) => {
    const response = {
        message: 'API Vigilancia QR - Backend corriendo correctamente',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    };
    logger_1.default.info({ response }, '🔍 Health check accedido');
    res.json(response);
});
app.use((err, req, res, next) => {
    const context = {
        path: req.path,
        method: req.method,
        body: req.body,
        query: req.query,
        errorMessage: err instanceof Error ? err.message : 'Error desconocido',
        stack: err instanceof Error ? err.stack : undefined,
    };
    const errorLogger = logger_1.default.child({ reqId: req.headers['x-request-id'] || 'unknown' });
    errorLogger.error(context, '🚨 Error global no manejado');
    let status = 500;
    let message = 'Error interno del servidor';
    if (err instanceof errorHandler_1.AppError) {
        status = err.statusCode;
        message = err.message;
    }
    else if (err instanceof Error) {
        message = err.message;
    }
    res.status(status).json({ error: message });
});
app.use('*', (req, res) => {
    logger_1.default.warn({ path: req.path, method: req.method }, '⚠️ Ruta no encontrada');
    res.status(404).json({
        error: 'Ruta no encontrada'
    });
});
app.listen(PORT, '0.0.0.0', () => {
    logger_1.default.info({ port: PORT }, '🚀 Servidor backend corriendo en puerto');
    if (process.env.NODE_ENV !== 'production') {
        logger_1.default.debug({ url: `http://localhost:${PORT}` }, '🔗 Acceso local');
    }
});
exports.default = app;
//# sourceMappingURL=app.js.map