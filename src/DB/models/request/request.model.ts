import { model, Schema } from "mongoose";
import { IRequest } from "../../../common";

const schema = new Schema<IRequest>(
  {
    // Both filtered on constantly: dashboard counts/lists, sendRequest's
    // duplicate check, accept/decline lookups.
    sender: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    receiver: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  },
  {
    timestamps: { createdAt: true },
  },
);

export const Request = model("Request", schema);
