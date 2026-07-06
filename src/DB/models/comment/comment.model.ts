import { model, Schema } from "mongoose";
import { IComment } from "../../../common";

const schema = new Schema<IComment>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    // Every comment listing filters on this (and optionally parentId).
    postId: { type: Schema.Types.ObjectId, ref: "Post", required: true, index: true },
    parentId: { type: Schema.Types.ObjectId, ref: "Comment", index: true },
    mentions: [{ type: Schema.Types.ObjectId, ref: "User" }],
    content: String,
    attachment: String,
    reactionsCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

schema.pre("deleteOne", async function () {
  // console.log(this);
  let filter = this.getFilter();

  const replies = await this.model.find({ parentId: filter._id });

  if (replies.length > 0) {
    for (const reply of replies) {
      await this.model.deleteOne({ _id: reply._id });
    }
  }
});


export const Comment = model("Comment", schema);
