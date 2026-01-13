"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pino_1 = __importDefault(require("pino"));
const baseConfig = {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    timestamp: pino_1.default.stdTimeFunctions.isoTime,
};
const transport = process.env.NODE_ENV !== 'production'
    ? pino_1.default.transport({
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
            ignore: 'pid,hostname',
            messageFormat: '{msg} [context: {reqId || "-"}]',
        },
    })
    : undefined;
const logger = (0, pino_1.default)(baseConfig, transport);
exports.default = logger;
//# sourceMappingURL=logger.js.map