/**
 * Multi-tenant Utilities
 *
 * Helper functions for working with multi-tenant data isolation
 */

import prisma from '../client';
import type { Prisma } from '@prisma/client';

/**
 * Get all records for a specific tenant (client)
 * Automatically filters by clientId
 */
export async function getClientData<T extends { clientId: string }>(
  model: keyof typeof prisma,
  clientId: string,
  where?: Partial<T>
): Promise<T[]> {
  const query = {
    where: {
      clientId,
      ...where,
    },
  };

  // @ts-expect-error - Dynamic model access
  return await prisma[model].findMany(query);
}

/**
 * Verify that a user has access to a specific client
 */
export async function verifyClientAccess(
  userId: string,
  clientId: string
): Promise<boolean> {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      clientId,
      status: 'ACTIVE',
    },
  });

  return !!user;
}

/**
 * Get client with usage statistics
 */
export async function getClientStats(clientId: string) {
  const [client, userCount, workflowCount, adAccountCount] = await Promise.all([
    prisma.client.findUnique({ where: { id: clientId } }),
    prisma.user.count({ where: { clientId, status: 'ACTIVE' } }),
    prisma.workflow.count({ where: { clientId } }),
    prisma.adAccount.count({ where: { clientId } }),
  ]);

  if (!client) {
    throw new Error(`Client ${clientId} not found`);
  }

  return {
    ...client,
    stats: {
      users: userCount,
      workflows: workflowCount,
      adAccounts: adAccountCount,
    },
    limits: {
      users: {
        current: userCount,
        max: client.maxUsers,
        remaining: client.maxUsers - userCount,
      },
      workflows: {
        current: workflowCount,
        max: client.maxWorkflows,
        remaining: client.maxWorkflows - workflowCount,
      },
      adAccounts: {
        current: adAccountCount,
        max: client.maxAdAccounts,
        remaining: client.maxAdAccounts - adAccountCount,
      },
    },
  };
}

/**
 * Check if client has reached a specific limit
 */
export async function hasReachedLimit(
  clientId: string,
  resource: 'users' | 'workflows' | 'adAccounts'
): Promise<boolean> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
  });

  if (!client) {
    throw new Error(`Client ${clientId} not found`);
  }

  let count: number;
  let limit: number;

  switch (resource) {
    case 'users':
      count = await prisma.user.count({ where: { clientId, status: 'ACTIVE' } });
      limit = client.maxUsers;
      break;
    case 'workflows':
      count = await prisma.workflow.count({ where: { clientId } });
      limit = client.maxWorkflows;
      break;
    case 'adAccounts':
      count = await prisma.adAccount.count({ where: { clientId } });
      limit = client.maxAdAccounts;
      break;
  }

  return count >= limit;
}
