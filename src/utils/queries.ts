/**
 * Common Database Queries
 *
 * Reusable query patterns for the automation platform
 */

import prisma from '../client';

/**
 * Get active workflows for a client
 */
export async function getActiveWorkflows(clientId: string) {
  return await prisma.workflow.findMany({
    where: {
      clientId,
      status: 'ACTIVE',
    },
    include: {
      adAccount: true,
      creator: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: {
      lastExecutedAt: 'desc',
    },
  });
}

/**
 * Get recent execution logs for a workflow
 */
export async function getRecentExecutions(
  workflowId: string,
  limit: number = 10
) {
  return await prisma.executionLog.findMany({
    where: {
      workflowId,
    },
    include: {
      workflow: {
        select: {
          name: true,
          type: true,
        },
      },
      adAccount: {
        select: {
          name: true,
          metaAdAccountId: true,
        },
      },
    },
    orderBy: {
      startedAt: 'desc',
    },
    take: limit,
  });
}

/**
 * Get execution statistics for a workflow
 */
export async function getWorkflowStats(workflowId: string, days: number = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const executions = await prisma.executionLog.findMany({
    where: {
      workflowId,
      startedAt: {
        gte: since,
      },
    },
    select: {
      status: true,
      duration: true,
      apiCallsUsed: true,
    },
  });

  const total = executions.length;
  const successful = executions.filter((e) => e.status === 'SUCCESS').length;
  const failed = executions.filter((e) => e.status === 'FAILED').length;
  const avgDuration =
    executions.reduce((sum, e) => sum + (e.duration || 0), 0) / total || 0;
  const totalApiCalls = executions.reduce((sum, e) => sum + e.apiCallsUsed, 0);

  return {
    period: {
      days,
      since: since.toISOString(),
    },
    executions: {
      total,
      successful,
      failed,
      successRate: total > 0 ? (successful / total) * 100 : 0,
    },
    performance: {
      avgDuration: Math.round(avgDuration),
      totalApiCalls,
      avgApiCallsPerExecution: total > 0 ? totalApiCalls / total : 0,
    },
  };
}

/**
 * Get reports for a specific period
 */
export async function getReportsByPeriod(
  clientId: string,
  startDate: Date,
  endDate: Date
) {
  return await prisma.report.findMany({
    where: {
      clientId,
      periodStart: {
        gte: startDate,
      },
      periodEnd: {
        lte: endDate,
      },
    },
    include: {
      workflow: {
        select: {
          name: true,
          type: true,
        },
      },
      adAccount: {
        select: {
          name: true,
          metaAdAccountId: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

/**
 * Get client's ad accounts with rate limit status
 */
export async function getAdAccountsWithLimits(clientId: string) {
  const accounts = await prisma.adAccount.findMany({
    where: {
      clientId,
    },
    select: {
      id: true,
      metaAdAccountId: true,
      name: true,
      status: true,
      apiCallsUsed: true,
      apiCallsLimit: true,
      rateLimitResetAt: true,
      lastSyncAt: true,
    },
    orderBy: {
      name: 'asc',
    },
  });

  return accounts.map((account) => ({
    ...account,
    rateLimitStatus: {
      used: account.apiCallsUsed,
      limit: account.apiCallsLimit,
      remaining: account.apiCallsLimit - account.apiCallsUsed,
      percentageUsed: (account.apiCallsUsed / account.apiCallsLimit) * 100,
      isNearLimit: account.apiCallsUsed / account.apiCallsLimit > 0.8,
      resetsAt: account.rateLimitResetAt,
    },
  }));
}
