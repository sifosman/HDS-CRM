"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const test_controller_1 = require("../controllers/test.controller");
const router = (0, express_1.Router)();
// Test endpoint to verify query parameter extraction
router.get('/test-query', test_controller_1.testQueryParams);
exports.default = router;
