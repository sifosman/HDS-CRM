"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const n8n_controller_1 = require("../controllers/n8n.controller");
const router = express_1.default.Router();
// Direct processing route for n8n data without MongoDB dependency
router.post('/process', n8n_controller_1.n8nController.processN8nData);
exports.default = router;
