"use strict";
// src/routes/vigiladorRoutes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const vigiladorController_1 = require("../controllers/vigiladorController"); // ← .js
const router = (0, express_1.Router)();
router.post('/submit', vigiladorController_1.VigiladorController.submit);
// router.get('/estado/:legajo', VigiladorController.getEstado);
exports.default = router;
