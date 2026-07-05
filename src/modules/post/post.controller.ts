import { Request, NextFunction, Response, Router } from "express";
import postService from "./post.service";
import mongoose from "mongoose";
import {
  createPostSchema,
  listPostsQuerySchema,
  updatePostSchema,
} from "./post.validation";
import { isAuthenticated, isvalid, uploadAttachments } from "../../middleware";
import { default as commentRouter } from "../comment/comment.controller";
import {
  addReaction,
  BadRequestException,
  generalFields as GF,
  NotFoundException,
  multerUploadFile,
} from "../../common";
import { postRepo } from "../../DB/models/post/post.repository";
// import { firebasePushNotificationProvider } from "../../common/notification/firebase/init";
import { redisCacheProvider } from "../../common/cache/redis/init";
import { AddReactionSchema } from "../../common/dto";

const router = Router();

router.use("/:postId/comment", commentRouter);

router.post(
  "/",
  multerUploadFile().array("attachments", 4),
  uploadAttachments("posts"),
  isvalid(createPostSchema),
  isAuthenticated,
  async (req: Request, res: Response, next: NextFunction) => {
    const createdPost = await postService.create(
      req.body,
      req.user._id,
      req.uploadedPublicIds,
    );
    return res.status(201).json({
      message: "post created successfully",
      success: true,
      data: { createdPost },
    });
  },
);

router.post(
  "/add-reaction",
  isvalid(AddReactionSchema),
  isAuthenticated,
  async (req: Request, res: Response, next: NextFunction) => {
    await addReaction(
      req.body,
      req.user._id,
      postRepo,
      // firebasePushNotificationProvider,
      redisCacheProvider,
    );
    // await postService.addReaction(
    //   req.body,
    //   req.user._id,
    // );
    return res.sendStatus(204);
  },
);

// get my posts and friend posts 
router.get(
  "/feed",
  isAuthenticated,
  async (req: Request, res: Response, next: NextFunction) => {
    const query = listPostsQuerySchema.parse(req.query);
    const feedPosts = await postService.getFeed(req.user._id, query);

    return res.status(200).json({
      success: true,
      ...feedPosts,
    });
  },
);


router.get(
  "/me",
  isAuthenticated,
  async (req: Request, res: Response, next: NextFunction) => {
    const query = listPostsQuerySchema.parse(req.query);
    const myPosts = await postService.getMyPosts(req.user._id, query);

    return res.status(200).json({
      success: true,
      ...myPosts,
    });
  },
);

// Public profile's posts tab - unauthenticated, same treatment as GET
// /:id below (a permalink already needs no auth). Two path segments, so
// registration order relative to the single-segment /:id catch-all
// below doesn't actually matter here, but it's kept above it anyway for
// readability, next to /feed and /me.
router.get(
  "/user/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    if (!GF.id.safeParse(req.params.id).success) {
      throw new NotFoundException("user not found");
    }
    const query = listPostsQuerySchema.parse(req.query);
    const posts = await postService.getByUser(
      new mongoose.Types.ObjectId(req.params.id as string),
      query,
    );

    return res.status(200).json({
      success: true,
      ...posts,
    });
  },
);

router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  if (!req.params.id) {
    throw new BadRequestException("send valid post ID");
  }
  const post = await postService.getOne(
    new mongoose.Types.ObjectId(req.params.id as string),
  );

  return res.status(200).json({
    success: true,
    data: post,
  });
});

router.patch(
  "/:id",
  isvalid(updatePostSchema),
  isAuthenticated,
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.params.id) {
      throw new BadRequestException("send valid post ID");
    }
    const post = await postService.update(
      new mongoose.Types.ObjectId(req.params.id as string),
      req.user._id,
      req.body,
    );

    return res.status(200).json({
      message: "post updated successfully",
      success: true,
      data: post,
    });
  },
);

router.delete(
  "/:id",
  isAuthenticated,
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.params.id) {
      throw new BadRequestException("send valid post ID");
    }
    const deletedCount = await postService.delete(
      new mongoose.Types.ObjectId(req.params.id as string),
      req.user._id,
    );

    return res.status(200).json({
      message: "post deleted successfully",
      success: true,
      data: deletedCount,
    });
  },
);

export default router;
