import { Request, Response, NextFunction, Router } from "express";
import commentService from "./comment.service";
import { isAuthenticated, isvalid } from "../../middleware";
import { createCommentSchema, updateCommentSchema } from "./comment.validation";
import { Types } from "mongoose";
import { addReaction } from "../../common";
import { commentRepo } from "../../DB/models/comment/comment.repository";
import { redisCacheProvider } from "../../common/cache/redis/init";

const router = Router({ mergeParams: true });

router.post(
  "/add-reaction",
  isAuthenticated,
  async (req: Request, res: Response, next: NextFunction) => {
    await addReaction(
      req.body,
      req.user._id,
      commentRepo,
      redisCacheProvider,
    );
    return res.sendStatus(204);
  },
);

router.post(
  "{/:parentId}",
  isvalid(createCommentSchema),
  isAuthenticated,
  async (req: Request, res: Response, next: NextFunction) => {
    // console.log({ params: req.params });
    const createdComment = await commentService.create(
      req.body,
      req.params,
      req.user._id,
    );
    return res.status(201).json({
      success: true,
      data: { createdComment },
    });
  },
);

router.get(
  "/:postId{/:parentId}",
  async (req: Request, res: Response, next: NextFunction) => {
    const comments = await commentService.getAll(req.params);
    res.status(200).json({
      success: true,
      data: { comments },
    });
  },
);

router.delete(
  "/:id",
  isAuthenticated,
  async (req: Request, res: Response, next: NextFunction) => {
    await commentService.delete(
      new Types.ObjectId(req.params.id as string),
      req.user._id,
    );
    return res.sendStatus(204);
  },
);

router.patch(
  "/:id",
  isvalid(updateCommentSchema),
  isAuthenticated,
  async (req: Request, res: Response, next: NextFunction) => {
    await commentService.update(
      new Types.ObjectId(req.params.id as string),
      req.user._id,
      req.body,
    );
    return res.sendStatus(204);
  },
);
export default router;
