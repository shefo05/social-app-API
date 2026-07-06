import z from "zod";

/**
 * A 0-1 char query against a $regex substring match is unselective by
 * design - it'd match nearly every userName for zero benefit, at the
 * cost of scanning every active user. Rejecting below 2 chars is
 * cheaper than running that query and more useful to the caller than a
 * silently-empty result (a typeahead UI shouldn't even fire the request
 * yet at that length).
 */
export const searchUsersQuerySchema = z.object({
  q: z.string().min(2).max(50),
  limit: z.coerce.number().int().min(1).max(20).default(10),
});
