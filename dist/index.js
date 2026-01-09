"use strict";
/**
 * Main entry point for the Code Review Agent
 * Exports the public API for programmatic usage
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportResults = exports.formatReviewResultAsMarkdown = exports.formatReviewResultAsJson = exports.formatReviewResult = exports.Logger = exports.logger = exports.CodeReviewAgent = void 0;
var code_reviewer_1 = require("./agents/code-reviewer");
Object.defineProperty(exports, "CodeReviewAgent", { enumerable: true, get: function () { return code_reviewer_1.CodeReviewAgent; } });
__exportStar(require("./types"), exports);
__exportStar(require("./config"), exports);
__exportStar(require("./hooks"), exports);
var logger_1 = require("./utils/logger");
Object.defineProperty(exports, "logger", { enumerable: true, get: function () { return logger_1.logger; } });
Object.defineProperty(exports, "Logger", { enumerable: true, get: function () { return logger_1.Logger; } });
var formatter_1 = require("./utils/formatter");
Object.defineProperty(exports, "formatReviewResult", { enumerable: true, get: function () { return formatter_1.formatReviewResult; } });
Object.defineProperty(exports, "formatReviewResultAsJson", { enumerable: true, get: function () { return formatter_1.formatReviewResultAsJson; } });
Object.defineProperty(exports, "formatReviewResultAsMarkdown", { enumerable: true, get: function () { return formatter_1.formatReviewResultAsMarkdown; } });
Object.defineProperty(exports, "exportResults", { enumerable: true, get: function () { return formatter_1.exportResults; } });
//# sourceMappingURL=index.js.map