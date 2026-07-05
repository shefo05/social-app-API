import mongoose, { Types } from "mongoose";
import { DB_URL } from "../config";
import { hash } from "../common/utils/bcrypt.utils";
import { SYS_GENDER, SYS_PROVIDER, SYS_REACTION, SYS_ROLE, ON_MODEL } from "../common/enums";
import { userRepo } from "../DB/models/user/user.repository";
import { postRepo } from "../DB/models/post/post.repository";
import { commentRepo } from "../DB/models/comment/comment.repository";
import { userFriendRepo } from "../DB/models/user-friend/user-friend.repository";
import { requestRepo } from "../DB/models/request/request.repository";
import { userReactionRepo } from "../DB/models/user-reaction/user-reaction.repository";

/**
 * Idempotent demo-data seeder: every seed user's email ends in
 * "@seed.demo", so re-running this script first wipes exactly that
 * cohort (and everything they own) before generating a fresh, internally
 * consistent dataset - never touches real accounts, and is always safe
 * to re-run rather than needing an interactive confirmation prompt.
 */

const SEED_EMAIL_SUFFIX = "@seed.demo";
const SEED_PASSWORD = "Seed@1234";

const PEOPLE: Array<{ first: string; last: string; gender: SYS_GENDER; bio: string }> = [
  { first: "Sarah", last: "Ahmed", gender: SYS_GENDER.female, bio: "Coffee enthusiast ☕ | Full-stack developer" },
  { first: "Omar", last: "Khaled", gender: SYS_GENDER.male, bio: "Traveling the world one city at a time ✈️" },
  { first: "Nourhan", last: "Ali", gender: SYS_GENDER.female, bio: "Photographer capturing life's little moments 📸" },
  { first: "Youssef", last: "Ibrahim", gender: SYS_GENDER.male, bio: "Bookworm 📚 | Always learning something new" },
  { first: "Mariam", last: "Hassan", gender: SYS_GENDER.female, bio: "Yoga instructor 🧘‍♀️ | Plant-based living" },
  { first: "Ahmed", last: "Mostafa", gender: SYS_GENDER.male, bio: "Software engineer by day, gamer by night 🎮" },
  { first: "Laila", last: "Mahmoud", gender: SYS_GENDER.female, bio: "Home baker 🍰 | Dog mom to two goldens" },
  { first: "Karim", last: "Adel", gender: SYS_GENDER.male, bio: "Football fanatic ⚽ | Weekend hiker" },
  { first: "Salma", last: "Tarek", gender: SYS_GENDER.female, bio: "UX designer | Sketching in my free time ✏️" },
  { first: "Hassan", last: "Fathy", gender: SYS_GENDER.male, bio: "Amateur chef | Always trying a new recipe 🍜" },
  { first: "Dina", last: "Samir", gender: SYS_GENDER.female, bio: "Marketing lead | Runs before sunrise 🏃‍♀️" },
  { first: "Amr", last: "Nabil", gender: SYS_GENDER.male, bio: "Musician 🎸 | Coffee shop regular" },
  { first: "Rania", last: "Sherif", gender: SYS_GENDER.female, bio: "Med student | Cat person 🐱" },
  { first: "Tamer", last: "Zaki", gender: SYS_GENDER.male, bio: "Startup founder | Building in public" },
  { first: "Heba", last: "Younes", gender: SYS_GENDER.female, bio: "Graphic designer | Always somewhere new 🌍" },
];

const POST_CONTENTS = [
  "Just shipped a new feature I've been working on for weeks. Feels good to finally see it live!",
  "Anyone else completely obsessed with their morning coffee routine?",
  "Spent the whole weekend hiking and honestly it was exactly what I needed.",
  "Reading a great book right now, highly recommend if you're into sci-fi.",
  "Can't believe how fast this year is going. Time to start planning for next year already.",
  "Tried a new recipe tonight and it actually turned out amazing. Will definitely make it again.",
  "Working from a coffee shop today - sometimes a change of scenery makes all the difference for focus.",
  "Finally finished that side project I've been putting off for months. Small wins count!",
  "Does anyone have recommendations for a good running playlist? My current one is getting stale.",
  "Big thanks to everyone who came out to support the local meetup last night, it was a blast.",
  "Rainy days are made for staying in with a blanket, tea, and a good movie.",
  "Started learning guitar again after years of not touching one. Fingers hurt but worth it.",
  "Sometimes the best ideas come when you're not even trying to think of one.",
  "Reorganized my whole workspace this weekend and somehow it made me way more productive.",
  "Grateful for good friends, good food, and a slow Sunday.",
  "Three years at this job today. Wild how time flies when you actually enjoy what you do.",
  "New plant added to the collection. Send help, this is becoming a real obsession.",
  "Nothing beats a long walk with good music when you need to clear your head.",
  "Finally got around to organizing all my old photos. So many good memories in there.",
  "Trying to get better about drinking more water. Small habits, big difference apparently.",
  "Caught the sunset from the roof tonight and it was unreal. Wish I could bottle that light.",
  "Learning to say no to things that don't serve me anymore. Progress, not perfection.",
  "Cooked for ten people last night and somehow everyone left happy. Miracle.",
  "Some days you just need to close the laptop early and go outside.",
  "Been meaning to write this down for a while: consistency really does beat intensity.",
  "Found an old journal from years ago and it's wild to see how much has changed.",
  "Coffee shop playlist on point today. Productivity through the roof.",
  "Half marathon training starts this week. Send good vibes, my knees need them.",
  "Reconnected with an old friend today after years of losing touch. Needed that.",
  "The best conversations happen over the worst coffee, somehow.",
  "Trying out a new morning routine and I actually feel like a functioning human before 9am now.",
  "Some weeks are just about surviving, and that's okay too.",
  "Finally watched that show everyone's been talking about. Understand the hype now.",
  "Small apartment, big plans. Slowly making this place feel like home.",
  "Grateful for a slow start to the day for once.",
];

const COMMENT_CONTENTS = [
  "This is great, congrats!",
  "So relatable honestly.",
  "Love this energy 🙌",
  "Needed to hear this today.",
  "Haha same here.",
  "That's awesome, well deserved.",
  "Wow, didn't expect that!",
  "Totally agree with this.",
  "This made my day.",
  "Can you share the recipe?",
  "Where was this?",
  "Following for updates!",
  "This is so true.",
  "Big same energy.",
  "Proud of you!",
];

const REPLY_CONTENTS = [
  "Thank you so much!",
  "Haha yeah exactly.",
  "Appreciate that!",
  "Will do, stay tuned.",
  "Right?? Couldn't believe it either.",
];

function pick<T>(arr: T[]): T {
  const item = arr[Math.floor(Math.random() * arr.length)];
  if (item === undefined) throw new Error("pick() called on empty array");
  return item;
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, arr.length));
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function wipeExistingSeedData() {
  const existing = await userRepo.getAll({ email: { $regex: `${SEED_EMAIL_SUFFIX}$` } });
  if (existing.length === 0) return;

  const userIds = existing.map((u) => u._id);
  console.log(`Wiping ${userIds.length} previously-seeded users and everything they own...`);

  const posts = await postRepo.getAll({ userId: { $in: userIds } }, { _id: 1 });
  const postIds = posts.map((p) => p._id);

  const comments = await commentRepo.getAll(
    { $or: [{ userId: { $in: userIds } }, { postId: { $in: postIds } }] },
    { _id: 1 },
  );
  const commentIds = comments.map((c) => c._id);

  await userReactionRepo.deleteMany({
    $or: [{ userId: { $in: userIds } }, { refId: { $in: [...postIds, ...commentIds] } }],
  });
  await commentRepo.deleteMany({ _id: { $in: commentIds } });
  await postRepo.deleteMany({ _id: { $in: postIds } });
  await requestRepo.deleteMany({ $or: [{ sender: { $in: userIds } }, { receiver: { $in: userIds } }] });
  await userFriendRepo.deleteMany({ $or: [{ user: { $in: userIds } }, { friend: { $in: userIds } }] });
  await userRepo.deleteMany({ _id: { $in: userIds } });
}

async function seed() {
  await mongoose.connect(DB_URL, { serverSelectionTimeoutMS: 5000 });
  console.log("Connected to DB for seeding.");

  await wipeExistingSeedData();

  const passwordHash = await hash(SEED_PASSWORD);

  const users = await Promise.all(
    PEOPLE.map((person, i) =>
      userRepo.create({
        userName: `${person.first} ${person.last}`,
        email: `${person.first}.${person.last}@seed.demo`.toLowerCase(),
        password: passwordHash,
        gender: person.gender,
        role: SYS_ROLE.user,
        provider: SYS_PROVIDER.system,
        profilePic: `https://i.pravatar.cc/300?img=${i + 1}`,
        bio: person.bio,
      }),
    ),
  );
  console.log(`Created ${users.length} seed users.`);

  // Posts: 35 across random users, ~1/3 carrying 1-2 "attachments" (plain
  // external image URLs - not real Cloudinary uploads, so no
  // attachmentPublicIds; nothing here will ever try to delete them).
  const posts = [];
  for (let i = 0; i < 35; i++) {
    const author = pick(users) as any;
    const attachments =
      Math.random() < 0.35
        ? Math.random() < 0.5
          ? [`https://picsum.photos/seed/post-${i}/800/600`]
          : [
              `https://picsum.photos/seed/post-${i}-a/800/600`,
              `https://picsum.photos/seed/post-${i}-b/800/600`,
            ]
        : undefined;
    const post = await postRepo.create({
      userId: author._id,
      content: pick(POST_CONTENTS),
      ...(attachments ? { attachments } : {}),
    });
    posts.push(post as any);
  }
  console.log(`Created ${posts.length} seed posts.`);

  // Comments + replies, tallying counts per post to set commentsCount
  // afterward (this bypasses commentService.create(), which is the only
  // thing that normally keeps that counter in sync via $inc).
  let totalComments = 0;
  for (const post of posts) {
    const commentCount = randomInt(0, 4);
    let postCommentTotal = 0;
    for (let c = 0; c < commentCount; c++) {
      const commenter = pick(users) as any;
      const comment = await commentRepo.create({
        userId: commenter._id,
        postId: post._id,
        content: pick(COMMENT_CONTENTS),
      });
      postCommentTotal++;

      if (Math.random() < 0.3) {
        const replyCount = randomInt(1, 2);
        for (let r = 0; r < replyCount; r++) {
          const replier = pick(users) as any;
          await commentRepo.create({
            userId: replier._id,
            postId: post._id,
            parentId: (comment as any)._id,
            content: pick(REPLY_CONTENTS),
          });
          postCommentTotal++;
        }
      }
    }
    if (postCommentTotal > 0) {
      await postRepo.updateOne({ _id: post._id }, { commentsCount: postCommentTotal });
    }
    totalComments += postCommentTotal;
  }
  console.log(`Created ${totalComments} seed comments/replies.`);

  // Reactions on posts: unique (userId, refId) pairs only.
  let totalReactions = 0;
  for (const post of posts) {
    if (Math.random() >= 0.7) continue;
    const reactors = pickN(users, randomInt(1, 6));
    for (const reactor of reactors as any[]) {
      await userReactionRepo.create({
        userId: reactor._id,
        refId: post._id,
        onModel: ON_MODEL.Post,
        reaction: randomInt(0, 5) as SYS_REACTION,
      });
      totalReactions++;
    }
    if (reactors.length > 0) {
      await postRepo.updateOne({ _id: post._id }, { reactionsCount: reactors.length });
    }
  }
  console.log(`Created ${totalReactions} seed reactions on posts.`);

  // Friendships: a partially-connected graph, 3-5 random friends per user,
  // deduped so (a, b) and (b, a) never both get created.
  const friendPairKeys = new Set<string>();
  for (const user of users as any[]) {
    const candidates = (users as any[]).filter((u) => u._id.toString() !== user._id.toString());
    const friends = pickN(candidates, randomInt(3, 5));
    for (const friend of friends) {
      const key = [user._id.toString(), friend._id.toString()].sort().join(":");
      if (friendPairKeys.has(key)) continue;
      friendPairKeys.add(key);
    }
  }
  for (const key of friendPairKeys) {
    const [userIdStr, friendIdStr] = key.split(":") as [string, string];
    await userFriendRepo.create({
      user: new Types.ObjectId(userIdStr),
      friend: new Types.ObjectId(friendIdStr),
    });
  }
  console.log(`Created ${friendPairKeys.size} seed friendships.`);

  // Pending requests: random pairs that aren't already friends.
  let requestsCreated = 0;
  let attempts = 0;
  while (requestsCreated < 8 && attempts < 100) {
    attempts++;
    const sender = pick(users) as any;
    const receiver = pick(users) as any;
    if (sender._id.toString() === receiver._id.toString()) continue;

    const key = [sender._id.toString(), receiver._id.toString()].sort().join(":");
    if (friendPairKeys.has(key)) continue;

    const alreadyRequested = await requestRepo.getOne({
      $or: [
        { sender: sender._id, receiver: receiver._id },
        { sender: receiver._id, receiver: sender._id },
      ],
    });
    if (alreadyRequested) continue;

    await requestRepo.create({ sender: sender._id, receiver: receiver._id });
    requestsCreated++;
  }
  console.log(`Created ${requestsCreated} seed pending friend requests.`);

  console.log("\nSeed complete.");
  console.log(`Log in as any seed user with password: ${SEED_PASSWORD}`);
  console.log("Example accounts:");
  for (const person of PEOPLE.slice(0, 3)) {
    console.log(`  ${person.first}.${person.last}@seed.demo`.toLowerCase());
  }

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
