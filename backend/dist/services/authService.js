"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerUser = registerUser;
exports.loginUser = loginUser;
exports.authMiddleware = authMiddleware;
const vigiladorRepository_1 = require("../repositories/vigiladorRepository");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const logger_1 = __importDefault(require("../utils/logger"));
const errorHandler_1 = require("../utils/errorHandler");
const JWT_SECRET_RAW = process.env.JWT_SECRET;
if (!JWT_SECRET_RAW || JWT_SECRET_RAW.length < 48) {
    const errorContext = {
        envVar: 'JWT_SECRET',
        length: JWT_SECRET_RAW?.length ?? 0,
        isSet: !!JWT_SECRET_RAW,
    };
    logger_1.default.error(errorContext, '🚨 JWT_SECRET no configurado o demasiado débil (mínimo 48 caracteres seguros)');
    throw new Error('Error de configuración crítica: JWT_SECRET inválido o ausente - Verifica .env y reinicia');
}
const JWT_SECRET = JWT_SECRET_RAW;
const SALT_ROUNDS = 12;
const RegisterSchema = zod_1.z.object({
    email: zod_1.z.string().email('Email inválido').min(5),
    password: zod_1.z.string().min(8, 'Mínimo 8 caracteres'),
    role: zod_1.z.enum(['ADMIN', 'CLIENT']).optional().default('CLIENT'),
});
const LoginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Email inválido'),
    password: zod_1.z.string().min(1, 'Contraseña requerida'),
});
async function registerUser(data) {
    const parsed = RegisterSchema.parse(data);
    const existingUser = await vigiladorRepository_1.prisma.user.findUnique({
        where: { email: parsed.email.toLowerCase() },
    });
    if (existingUser) {
        logger_1.default.warn({ email: parsed.email }, '⚠️ Intento de registro duplicado');
        throw new errorHandler_1.ValidationError('Email ya registrado');
    }
    const hashedPassword = await bcryptjs_1.default.hash(parsed.password, SALT_ROUNDS);
    const user = await vigiladorRepository_1.prisma.user.create({
        data: {
            email: parsed.email.toLowerCase(),
            password: hashedPassword,
            role: parsed.role,
        },
        select: { id: true, email: true, role: true },
    });
    logger_1.default.info({ userId: user.id, role: user.role }, '✅ Usuario registrado exitosamente');
    return user;
}
async function loginUser(data) {
    const parsed = LoginSchema.parse(data);
    const user = await vigiladorRepository_1.prisma.user.findUnique({
        where: { email: parsed.email.toLowerCase() },
        include: { servicio: true },
    });
    if (!user) {
        logger_1.default.warn({ email: parsed.email }, '⚠️ Login fallido: usuario no encontrado');
        throw new errorHandler_1.ForbiddenError('Credenciales inválidas');
    }
    const passwordMatch = await bcryptjs_1.default.compare(parsed.password, user.password);
    if (!passwordMatch) {
        logger_1.default.warn({ userId: user.id }, '⚠️ Login fallido: contraseña incorrecta');
        throw new errorHandler_1.ForbiddenError('Credenciales inválidas');
    }
    const payload = {
        id: user.id,
        email: user.email,
        role: user.role,
        ...(user.role === 'CLIENT' && user.servicioId ? { servicioId: user.servicioId } : {}),
    };
    const token = jsonwebtoken_1.default.sign(payload, JWT_SECRET, { expiresIn: '1h' });
    logger_1.default.info({ userId: user.id, role: user.role, servicioId: payload.servicioId }, '✅ Login exitoso - JWT generado');
    return { token };
}
function authMiddleware(allowedRoles) {
    return (req, res, next) => {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            logger_1.default.warn({ path: req.path, ip: req.ip }, '⚠️ Acceso sin token');
            return res.status(401).json({ error: 'Token requerido' });
        }
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
            if (decoded.role === 'CLIENT') {
                const servicioIdFromReq = req.query.servicioId || req.body.servicioId;
                if (servicioIdFromReq && servicioIdFromReq !== decoded.servicioId) {
                    logger_1.default.warn({ userId: decoded.id, attemptedServicio: servicioIdFromReq }, '⚠️ Scoping violado');
                    throw new errorHandler_1.ForbiddenError('Acceso denegado: servicio no autorizado');
                }
            }
            if (!allowedRoles.includes(decoded.role)) {
                logger_1.default.warn({ attemptedRole: decoded.role, userId: decoded.id }, '⚠️ Rol no autorizado');
                throw new errorHandler_1.ForbiddenError('Acceso denegado - rol insuficiente');
            }
            req.user = decoded;
            logger_1.default.info({ userId: decoded.id, role: decoded.role, path: req.path }, '✅ Autenticación JWT exitosa');
            next();
        }
        catch (err) {
            let message;
            if (err instanceof jsonwebtoken_1.default.TokenExpiredError) {
                message = 'Token expirado';
            }
            else if (err instanceof jsonwebtoken_1.default.JsonWebTokenError) {
                message = 'Token inválido';
            }
            else {
                message = 'Error de autenticación';
            }
            const errorContext = {
                error: err.message,
                tokenPrefix: token?.slice(0, 10) || 'none',
                ip: req.ip,
            };
            logger_1.default.error(errorContext, `🚨 ${message}`);
            return res.status(401).json({ error: message });
        }
    };
}
//# sourceMappingURL=authService.js.map