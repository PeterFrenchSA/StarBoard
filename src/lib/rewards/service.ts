import { db } from "@/lib/db";
import { getChildPoints } from "@/lib/points/service";

export async function canChildAffordReward(familyId: string, childId: string, rewardId: string): Promise<boolean> {
  const [points, reward] = await Promise.all([
    getChildPoints(familyId, childId),
    db.reward.findFirst({
      where: {
        id: rewardId,
        familyId,
        isActive: true
      }
    })
  ]);

  if (!reward) {
    return false;
  }

  return points >= reward.cost;
}
