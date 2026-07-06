import { NextFunction, Request, Response, Router } from "express";
import userService from "./user.service";
import { isAuthenticated } from "../../middleware";
import { BadRequestException, generalFields as GF, NotFoundException } from "../../common";
import { Types } from "mongoose";
import { searchUsersQuerySchema } from "./user.validation";

const router = Router();

router.get(
  "/",
  isAuthenticated,
  async (req: Request, res: Response, next: NextFunction) => {
    const { user, friends } = await userService.profile(req.user._id);
    return res
      .status(200)
      .json({ message: "success", data: { user, friends } });
  },
);

router.get(
  "/online-friends",
  isAuthenticated,
  async (req: Request, res: Response, next: NextFunction) => {
    const onlineFriendIds = await userService.getOnlineFriends(req.user._id);
    return res.status(200).json({ message: "success", data: { onlineFriendIds } });
  },
);

// Authenticated (unlike the public GET /:id below) - a name-search
// endpoint is a discovery feature for logged-in members, not something
// worth exposing anonymously. Must stay registered before the /:id
// catch-all below, same reason as /online-friends above.
router.get(
  "/search",
  isAuthenticated,
  async (req: Request, res: Response, next: NextFunction) => {
    const result = searchUsersQuerySchema.safeParse(req.query);
    if (!result.success) {
      throw new BadRequestException(
        "send a search query (\"q\") of at least 2 characters",
      );
    }
    const users = await userService.search(
      req.user._id,
      result.data.q,
      result.data.limit,
    );
    return res.status(200).json({ message: "success", data: users });
  },
);

// Public profile - unauthenticated, same treatment as GET /post/:id.
// Must stay registered after the specific routes above (/, /online-friends):
// it's a single-segment catch-all, so anything registered after this
// point would never be reachable.
router.get(
  "/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    if (!GF.id.safeParse(req.params.id).success) {
      throw new NotFoundException("user not found");
    }
    const user = await userService.getPublicProfile(
      new Types.ObjectId(req.params.id as string),
    );
    return res.status(200).json({ message: "success", data: user });
  },
);

export default router;
