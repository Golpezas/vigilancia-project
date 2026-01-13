"use strict";
// src/routes/vigiladorRoutes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const vigiladorController_1 = require("../controllers/vigiladorController"); // ← .js
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = (0, express_1.Router)();
router.post('/submit', vigiladorController_1.VigiladorController.submit);
router.get('/estado/:legajo', vigiladorController_1.VigiladorController.getEstado);
router.get('/estado/:legajo', (0, authMiddleware_1.requireAuth)(['ADMIN', 'CLIENT']), vigiladorController_1.VigiladorController.getEstado);
exports.default = router;
//# sourceMappingURL=vigiladorRoutes.js.map