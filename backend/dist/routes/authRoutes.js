"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authService_1 = require("../services/authService");
const zod_1 = require("zod");
const router = (0, express_1.Router)();
const AuthSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8),
});
router.post('/register', async (req, res) => {
    try {
        const result = await (0, authService_1.registerUser)(req.body);
        res.status(201).json(result);
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
router.post('/login', async (req, res) => {
    try {
        const result = await (0, authService_1.loginUser)(req.body);
        res.json(result);
    }
    catch (err) {
        res.status(401).json({ error: err.message });
    }
});
exports.default = router;
//# sourceMappingURL=authRoutes.js.map