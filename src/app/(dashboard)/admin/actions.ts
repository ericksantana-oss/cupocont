"use server";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { computeClientProgress, isPeriodOverdue, type ClientProgress } from "@/lib/planningProgress";
import { currentPeriod } from "@/lib/periodo";

export type ClientOverview = {
  clientId: string;
  clientName: string;
  ownerId: string | null;
  ownerName: string | null;
  progress: ClientProgress;
  lastActivityAt: Date | null;
  overdue: boolean;
};

async function loadClientsWithProgress(period: string): Promise<ClientOverview[]> {
  const clients = await db.client.findMany({
    include: { owner: { select: { id: true, name: true } } },
    orderBy: { name: "asc" },
  });

  return Promise.all(
    clients.map(async (client) => {
      const [progress, lastActivity] = await Promise.all([
        computeClientProgress(client.id, period),
        db.activityLog.findFirst({ where: { clientId: client.id }, orderBy: { createdAt: "desc" } }),
      ]);

      return {
        clientId: client.id,
        clientName: client.name,
        ownerId: client.owner?.id ?? null,
        ownerName: client.owner?.name ?? null,
        progress,
        lastActivityAt: lastActivity?.createdAt ?? null,
        overdue: isPeriodOverdue(period) && progress.percent < 100,
      };
    })
  );
}

export async function getClientsOverview(period?: string): Promise<ClientOverview[]> {
  await requireAdmin();
  return loadClientsWithProgress(period ?? currentPeriod());
}

export type TeamOverview = {
  userId: string;
  name: string;
  role: "ADMIN" | "WRITER";
  clientsCount: number;
  completedCount: number;
  incompleteCount: number;
  lastActivityAt: Date | null;
};

export async function getTeamOverview(period?: string): Promise<TeamOverview[]> {
  await requireAdmin();
  const targetPeriod = period ?? currentPeriod();

  const [users, clientsProgress] = await Promise.all([
    db.user.findMany({ where: { role: "WRITER" }, orderBy: { name: "asc" } }),
    loadClientsWithProgress(targetPeriod),
  ]);

  return Promise.all(
    users.map(async (user) => {
      const owned = clientsProgress.filter((c) => c.ownerId === user.id);
      const completedCount = owned.filter((c) => c.progress.percent === 100).length;
      const lastActivity = await db.activityLog.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
      });

      return {
        userId: user.id,
        name: user.name,
        role: user.role,
        clientsCount: owned.length,
        completedCount,
        incompleteCount: owned.length - completedCount,
        lastActivityAt: lastActivity?.createdAt ?? null,
      };
    })
  );
}

export type ActivityFeedItem = {
  id: string;
  action: string;
  detail: string | null;
  period: string | null;
  createdAt: Date;
  clientName: string;
  userName: string;
};

export async function getActivityFeed(limit = 50): Promise<ActivityFeedItem[]> {
  await requireAdmin();

  const logs = await db.activityLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { client: { select: { name: true } }, user: { select: { name: true } } },
  });

  return logs.map((log) => ({
    id: log.id,
    action: log.action,
    detail: log.detail,
    period: log.period,
    createdAt: log.createdAt,
    clientName: log.client.name,
    userName: log.user.name,
  }));
}
