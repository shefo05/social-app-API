import express, { NextFunction, Request, Response } from "express";
import {
  authRouter,
  commentRouter,
  postRouter,
  requestRouter,
  userRouter,
} from "./modules";
import cors from 'cors'
import { BadRequestException } from "./common";
import { connectDB } from "./DB/connection";
import { redisConnect } from "./DB/redis.connect";
import { createHandler } from "graphql-http/lib/use/express";
import { GraphQLError, GraphQLObjectType, GraphQLSchema, GraphQLString } from "graphql";
import { postMutationGql } from "./modules/post/graphql/post.mutation.gql";
import { RealtimeGateway } from "./common/realtime-gateway/realtime.gateway";
import { scheduleAccountCleanupJob } from "./common/jobs/cleanup-deleted-accounts.job";

export function bootstrap() {
  const app = express();
  const port = process.env.PORT || 3000;

  app.get("/health", (req: Request, res: Response) => {
    res.status(200).json({ status: "ok", uptime: process.uptime() });
  });

  connectDB();
  redisConnect();

  app.use(express.json());
  app.use(cors({ origin: "*" }));

  const query = new GraphQLObjectType({
    name: "RootQuery",
    fields: {
      // The `user`/`post`/`comment` queries that used to live here always
      // resolved a single hardcoded document with no auth check and no
      // argument to change that - one of them turned out to be a real,
      // unauthenticated PII leak of an actual account. Removed outright
      // rather than fixed, since none of them were usable for any real
      // client anyway. GraphQL requires a query type to have at least one
      // field, hence this placeholder - add real, argument-taking,
      // authenticated queries here if GraphQL read parity is wanted.
      _empty: { type: GraphQLString, resolve: () => null },
    },
  });

  const mutation = new GraphQLObjectType({
    name: "RootMutaton",
    fields: {
      //auth
      //post
      ...postMutationGql,
      //comment
      //request
    },
  });

  const schema = new GraphQLSchema({
    query,
    mutation,
  });
  app.all(
    "/graphql",
    createHandler({
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
        } as unknown as GraphQLError;
      },
    }),
  );

  app.use("/auth", authRouter);
  app.use('/user',userRouter)
  app.use("/post", postRouter);
  app.use("/comment", commentRouter);
  app.use("/request", requestRouter);

  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.log(err);

    return res.status((err.cause as number) || 500).json({
      message: err.message,
      success: false,
      details: err instanceof BadRequestException ? err.details : undefined,
    });
  });

  const server = app.listen(port, () => {
    console.log("app is running on port", port);
  });

  new RealtimeGateway(server);
  scheduleAccountCleanupJob();
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
