"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isvalidGQL = exports.isvalid = void 0;
const common_1 = require("../common");
const isvalid = (schema) => {
    return async (req, res, next) => {
        const result = await schema.safeParseAsync(req.body);
        if (!result.success) {
            const errMessages = result.error.issues.map((issue) => ({
                path: issue.path[0],
                message: issue.message,
            }));
            throw new common_1.BadRequestException("validation error", errMessages);
        }
        next();
    };
};
exports.isvalid = isvalid;
const isvalidGQL = async (schema, args) => {
    const result = await schema.safeParseAsync(args);
    if (!result.success) {
        const errMessages = result.error.issues.map((issue) => ({
            path: issue.path[0],
            message: issue.message,
        }));
        throw new common_1.BadRequestException("validation error", errMessages);
    }
    return;
};
exports.isvalidGQL = isvalidGQL;
