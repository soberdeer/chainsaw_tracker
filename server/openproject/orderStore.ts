import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const storePath = join(dirname(fileURLToPath(import.meta.url)), 'seed-data', 'task-order.json');

type TaskOrderStore = {
  lists: Record<string, Record<string, string[]>>;
};

let cachedStore: TaskOrderStore | undefined;

async function readStore(): Promise<TaskOrderStore> {
  if (cachedStore) return cachedStore;
  try {
    cachedStore = JSON.parse(await readFile(storePath, 'utf8')) as TaskOrderStore;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn(`Unable to read OpenProject task order store: ${(error as Error).message}`);
    }
    cachedStore = { lists: {} };
  }
  return cachedStore;
}

async function writeStore(store: TaskOrderStore) {
  await writeFile(storePath, `${JSON.stringify(store, null, 2)}\n`);
  cachedStore = store;
}

export async function taskOrderFor(listId: string, statusId: string) {
  const store = await readStore();
  return store.lists[listId]?.[statusId] || [];
}

export async function positionTasks<T extends { id: string; statusId?: string; position: number }>(
  listId: string,
  tasks: T[]
) {
  const store = await readStore();
  const listOrder = store.lists[listId] || {};
  return tasks.map((task) => {
    const order = task.statusId ? listOrder[task.statusId] || [] : [];
    const orderIndex = order.indexOf(task.id);
    return {
      ...task,
      position: orderIndex >= 0 ? orderIndex : task.position + 100000,
    };
  });
}

export async function saveTaskOrder(input: {
  listId: string;
  taskId: string;
  statusId: string;
  orderedTaskIds: string[];
}) {
  const store = await readStore();
  store.lists[input.listId] ||= {};

  for (const [statusId, orderedIds] of Object.entries(store.lists[input.listId])) {
    if (statusId !== input.statusId) {
      store.lists[input.listId][statusId] = orderedIds.filter((id) => id !== input.taskId);
    }
  }

  const deduped = input.orderedTaskIds.filter((id, index, ids) => ids.indexOf(id) === index);
  if (!deduped.includes(input.taskId)) {
    deduped.push(input.taskId);
  }
  store.lists[input.listId][input.statusId] = deduped;
  await writeStore(store);
}
