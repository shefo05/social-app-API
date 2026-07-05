import { NextFunction, Request, Response, Router } from "express";
import userService from "./user.service";
import { isAuthenticated } from "../../middleware";
import { generalFields as GF, NotFoundException } from "../../common";
import { Types } from "mongoose";

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
