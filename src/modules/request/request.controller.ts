import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { isAuthenticated } from "../../middleware";
import requestService from "./request.service";
import { requestDashboardQuerySchema } from "./request.validation";

const router = Router();

router.get(
  "/dashboard",
  isAuthenticated,
  async (req: Request, res: Response, next: NextFunction) => {
    const query = requestDashboardQuerySchema.parse(req.query);
    const dashboard = await requestService.getDashboard(req.user._id, query);
    return res.status(200).json({
      success: true,
      data: dashboard,
    });
  },
);

router.post(
  "/:receiverId",
  isAuthenticated,
  async (req: Request, res: Response, next: NextFunction) => {
    await requestService.sendRequest(
      req.user._id,
      req.params.receiverId as string,
    );
    return res.sendStatus(204);
  },
);

// Sender-only withdrawal of a request they sent, while it's still
// pending - distinct from decline (either party, see declineRequest2),
// and emits request:cancelled to the receiver so their incoming
// list/badge updates live, unlike decline which stays silent.
router.delete(
  "/cancel/:requestId",
  isAuthenticated,
  async (req: Request, res: Response, next: NextFunction) => {
    await requestService.cancelRequest(
      req.user._id,
      req.params.requestId as string,
    );
    return res.sendStatus(204);
  },
);

router.post(
  "/accept/:id",
  isAuthenticated,
  async (req: Request, res: Response, next: NextFunction) => {
    await requestService.acceptRequest(req.user._id, req.params.id as string);
    return res.sendStatus(204);
  },
);

router.post(
  "/decline/:id",
  isAuthenticated,
  async (req: Request, res: Response, next: NextFunction) => {
    await requestService.declineRequest2(req.user._id, req.params.id as string);
    return res.sendStatus(204);
  },
);

router.delete(
  "/remove/:friendId",
  isAuthenticated,
  async (req: Request, res: Response, next: NextFunction) => {
    await requestService.removeFriend(
      req.user._id,
      req.params.friendId as string,
    );
    return res.sendStatus(204);
  },
);

export default router;
