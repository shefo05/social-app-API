"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAuthGQL = void 0;
const common_1 = require("../common");
const isAuthGQL = (context) => {
    const authorization = context.headers.authorization;
    const token = authorization.split(" ")[1];
    // console.log(authorization);
    if (!token)
        throw new common_1.BadRequestException("token is required");
    context.payload = (0, common_1.verifyToken)(token);
    // console.log(context.payload);
    return;
};
exports.isAuthGQL = isAuthGQL;
