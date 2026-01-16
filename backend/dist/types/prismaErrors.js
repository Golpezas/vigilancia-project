"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPrismaKnownError = isPrismaKnownError;
function isPrismaKnownError(err) {
    return (err instanceof Error &&
        'code' in err &&
        typeof err.code === 'string' &&
        err.code.startsWith('P'));
}
//# sourceMappingURL=prismaErrors.js.map