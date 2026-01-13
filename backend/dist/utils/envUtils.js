"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const zod_1 = require("zod");
const logger_1 = __importDefault(require("./logger"));
const EnvSchema = zod_1.z.object({
    JWT_SECRET: zod_1.z.string().min(48),
    NODE_ENV: zod_1.z.enum(['development', 'production']).default('development'),
});
const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
    logger_1.default.error({ issues: parsed.error.issues }, 'Variables de entorno inválidas');
    throw new Error('Configuración de entorno inválida');
}
exports.env = parsed.data;
//# sourceMappingURL=envUtils.js.map