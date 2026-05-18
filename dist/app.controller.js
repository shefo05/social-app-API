"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bootstrap = bootstrap;
const express_1 = __importDefault(require("express"));
const modules_1 = require("./modules");
const common_1 = require("./common");
const connection_1 = require("./DB/connection");
const redis_connect_1 = require("./DB/redis.connect");
const init_1 = require("./common/cloud/s3/init");
const node_stream_1 = require("node:stream");
const node_util_1 = require("node:util");
const express_2 = require("graphql-http/lib/use/express");
const graphql_1 = require("graphql");
const user_query_gql_1 = require("./modules/auth/graphql/user.query.gql");
const post_query_gql_1 = require("./modules/post/graphql/post.query.gql");
const comment_gql_query_1 = require("./modules/comment/graphql/comment.gql.query");
const post_mutation_gql_1 = require("./modules/post/graphql/post.mutation.gql");
const pipelinePromise = (0, node_util_1.promisify)(node_stream_1.pipeline);
function bootstrap() {
    const app = (0, express_1.default)();
    const port = 3000;
    app.get("/uploads/*paths", async (req, res, next) => {
        console.log(req.params.paths);
        let key = req.params.paths.join("/");
        console.log(key);
        const fileExist = await init_1.s3CloudProvider.getFile(key);
        if (!fileExist) {
            new common_1.NotFoundException("file not found");
        }
        await pipelinePromise(fileExist, res);
    });
    (0, connection_1.connectDB)();
    (0, redis_connect_1.redisConnect)();
    app.use(express_1.default.json());
    const query = new graphql_1.GraphQLObjectType({
        name: "RootQuery",
        fields: {
            //user
            ...user_query_gql_1.userGQLQuery,
            //post
            ...post_query_gql_1.postGQLQuery,
            //comment
            ...comment_gql_query_1.commentGQLQuery,
            //request
        },
    });
    const mutation = new graphql_1.GraphQLObjectType({
        name: "RootMutaton",
        fields: {
            //auth
            //post
            ...post_mutation_gql_1.postMutationGql,
            //comment
            //request
        },
    });
    const schema = new graphql_1.GraphQLSchema({
        query,
        mutation,
    });
    app.all("/graphql", (0, express_2.createHandler)({
        context: (req) => {
            const headers = req.headers;
            return { headers };
        },
        schema,
        formatError: (error) => {
            return {
                message: error.message,
                success: false,
                statusCode: error.cause || 500,
            };
        },
    }));
    app.use("/auth", modules_1.authRouter);
    app.use("/post", modules_1.postRouter);
    app.use("/comment", modules_1.commentRouter);
    app.use("/request", modules_1.requestRouter);
    app.use((err, req, res, next) => {
        console.log(err);
        return res.status(err.cause || 500).json({
            message: err.message,
            success: false,
            details: err instanceof common_1.BadRequestException ? err.details : undefined,
        });
    });
    app.listen(port, () => {
        console.log("app is running on port", port);
    });
}
// import { createHandler } from "graphql-http/lib/use/express";
// import { GraphQLObjectType, GraphQLSchema } from "graphql";
// import { postQuery } from "./modules/post/graphql/post.gql";
// import { userMutation, userQuery } from "./modules/auth/graphql/user.gql";
// let query = new GraphQLObjectType({
//   name: "RootQuery",
//   fields: {
//     ...userQuery,
//     ...postQuery,
//   },
// });
// let mutation = new GraphQLObjectType({
//   name: "RootMutation",
//   fields: {
//     ...userMutation
//   }
// });
// let schema = new GraphQLSchema({
//   query,
//   mutation,
// });
// app.all("/graphql", createHandler({ schema }));
