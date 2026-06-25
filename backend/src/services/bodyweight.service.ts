import prisma from '../lib/db';

export interface BodyweightEntryDTO {
  id: number;
  weight: number;
  recordedAt: string;
}

function toDTO(entry: { id: number; weight: { toNumber(): number }; recordedAt: Date }): BodyweightEntryDTO {
  return {
    id: entry.id,
    weight: entry.weight.toNumber(),
    recordedAt: entry.recordedAt.toISOString(),
  };
}

export async function logBodyweight(userId: number, weight: number): Promise<BodyweightEntryDTO> {
  const entry = await prisma.bodyweightEntry.create({ data: { userId, weight } });
  return toDTO(entry);
}

export async function getBodyweightHistory(userId: number): Promise<BodyweightEntryDTO[]> {
  const entries = await prisma.bodyweightEntry.findMany({
    where: { userId },
    orderBy: { recordedAt: 'asc' },
  });
  return entries.map(toDTO);
}

// Returns false when nothing was deleted (not the user's entry / not found).
export async function deleteBodyweightEntry(userId: number, id: number): Promise<boolean> {
  const result = await prisma.bodyweightEntry.deleteMany({ where: { id, userId } });
  return result.count > 0;
}
