import type { Challenge, LeaderboardType, User } from "../domain/models.js";
import { isLeaderboardEligible } from "./defaultEngine.js";

const scoreByBoard: Record<LeaderboardType, (challenge: Challenge) => number> = {
  highest_stakes: (challenge) => challenge.stake.estimatedValue,
  most_watched: (challenge) => challenge.watchers,
  most_interesting: (challenge) => challenge.interestingScore,
};

export function rankLeaderboard(
  challenges: Challenge[],
  users: User[],
  board: LeaderboardType,
) {
  const usersById = new Map(users.map((user) => [user.id, user]));

  return challenges
    .filter((challenge) => {
      const creator = usersById.get(challenge.creatorId);
      return creator ? isLeaderboardEligible(creator) : false;
    })
    .toSorted((a, b) => scoreByBoard[board](b) - scoreByBoard[board](a))
    .map((challenge, index) => ({
      challenge,
      placement: { board, rank: index + 1 },
    }));
}
