import { NextFunction, Request, Response, Router } from "express";
import userService from "./user.service";
import { isAuthenticated } from "../../middleware";

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

export default router;
