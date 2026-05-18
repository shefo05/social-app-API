import {
  GraphQLBoolean,
  GraphQLList,
  GraphQLNonNull,
  GraphQLString,
} from "graphql";
import postService from "../post.service";
import { PostGQLType } from "./post.type.gql";
import { Types } from "mongoose";
import { isAuthGQL, isvalidGQL } from "../../../middleware";
import { createPostSchema, updatePostSchema } from "../post.validation";

export const postMutationGql = {
  addPost: {
    type: PostGQLType,
    args: {
      content: { type: GraphQLString },
      attachments: { type: new GraphQLList(GraphQLString) },
    },
    resolve: async (
      _: any,
      args: { content: string; attachments: string[] },
      context: any,
    ) => {
      isAuthGQL(context);
      // console.log(context);
      await isvalidGQL(createPostSchema, args);

      return await postService.create(
        args,
        new Types.ObjectId(context.payload.sub),
      );
    },
  },

  updatePost: {
    type: PostGQLType,
    args: {
      content: { type: GraphQLString },
      attachments: { type: new GraphQLList(GraphQLString) },
      postId: { type: new GraphQLNonNull(GraphQLString) },
    },
    resolve: async (
      _: any,
      args: {
        content: string;
        attachments: string[];
        postId: string;
      },
      context: any,
    ) => {
      isAuthGQL(context);
      // console.log(context);
      await isvalidGQL(updatePostSchema, args);

      return await postService.update(
        new Types.ObjectId(args.postId),
        new Types.ObjectId(context.payload.sub),
        args,
      );
    },
  },
  deletePost: {
    type: GraphQLBoolean,
    args: {
      postId: { type: new GraphQLNonNull(GraphQLString) },
    },
    resolve: async (_: any, args: { postId: string },context:any) => {
      isAuthGQL(context);

      const deletedCount = await postService.delete(
        new Types.ObjectId(args.postId),
        new Types.ObjectId(context.payload.sub),
      );
      return !!deletedCount;
    },
  },
};
