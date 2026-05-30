import { Group, ScrollArea } from '@mantine/core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Task, TaskStatus } from '@/lib';
import { BoardColumn } from './BoardColumn';
import classes from './TaskBoard.module.css';

export interface TaskBoardProps {
  tasks: Task[];
  statuses: TaskStatus[];
  canWriteTasks: boolean;
  onOpenTask: (task: Task) => void;
  onAddTask: (statusId: string) => void;
  onMoveTask: (
    taskId: string,
    statusId: string,
    targetTaskId?: string | null
  ) => Promise<void> | void;
  sortDir?: 'asc' | 'desc';
}

function isPinnedBottom(status: TaskStatus): boolean {
  const name = status.name.toLowerCase();
  return (
    (status as any).statusType === 'closed' ||
    name.includes('on hold') ||
    name.includes('cancelled')
  );
}

function computeStatusOrder(statuses: TaskStatus[], sortDir: 'asc' | 'desc'): TaskStatus[] {
  const main = statuses.filter((s) => !isPinnedBottom(s));
  const pinned = statuses.filter((s) => isPinnedBottom(s));
  const sorted = [...main].sort((a, b) =>
    sortDir === 'asc' ? a.position - b.position : b.position - a.position
  );
  return [...sorted, ...pinned];
}

export function TaskBoard({
  tasks,
  statuses,
  canWriteTasks,
  onOpenTask,
  onAddTask,
  onMoveTask,
  sortDir = 'asc',
}: TaskBoardProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const draggingTaskIdRef = useRef<string | null>(null);
  const draggingStatusIdRef = useRef<string | null>(null);

  const computedOrder = useMemo(() => computeStatusOrder(statuses, sortDir), [statuses, sortDir]);
  const [statusOrder, setStatusOrder] = useState<TaskStatus[]>(computedOrder);

  useEffect(() => {
    setStatusOrder(computeStatusOrder(statuses, sortDir));
  }, [statuses, sortDir]);

  const grouped = new Map(statusOrder.map((status) => [status.id, [] as Task[]]));
  tasks.forEach((task) => {
    const key = task.statusId || statusOrder[0]?.id;
    if (!key) return;
    grouped.set(key, [...(grouped.get(key) || []), task]);
  });

  // ── Task DnD (refs only, no re-renders during drag) ───────────────────
  const handleTaskDragStart = useCallback((taskId: string) => {
    draggingTaskIdRef.current = taskId;
    boardRef.current?.setAttribute('data-dragging-task', taskId);
  }, []);

  const handleTaskDragEnd = useCallback(() => {
    draggingTaskIdRef.current = null;
    boardRef.current?.removeAttribute('data-dragging-task');
  }, []);

  // ── Status DnD (refs + minimal state for CSS fade) ────────────────────
  const handleStatusDragStart = useCallback((statusId: string) => {
    draggingStatusIdRef.current = statusId;
    boardRef.current?.setAttribute('data-dragging-status', statusId);
    boardRef.current
      ?.querySelector(`[data-status-col="${statusId}"]`)
      ?.classList.add(classes.columnDragging);
  }, []);

  const handleStatusDragEnd = useCallback(() => {
    const id = draggingStatusIdRef.current;
    draggingStatusIdRef.current = null;
    const el = boardRef.current;
    if (!el) return;
    el.removeAttribute('data-dragging-status');
    if (id) el.querySelector(`[data-status-col="${id}"]`)?.classList.remove(classes.columnDragging);
    el.querySelectorAll('[data-status-over]').forEach((n) => n.removeAttribute('data-status-over'));
    el.querySelectorAll('[data-active]').forEach((n) => n.removeAttribute('data-active'));
  }, []);

  const handleStatusDrop = useCallback((afterStatusId: string | null) => {
    const id = draggingStatusIdRef.current;
    draggingStatusIdRef.current = null;
    const el = boardRef.current;
    if (el) {
      el.removeAttribute('data-dragging-status');
      if (id)
        el.querySelector(`[data-status-col="${id}"]`)?.classList.remove(classes.columnDragging);
      el.querySelectorAll('[data-status-over]').forEach((n) =>
        n.removeAttribute('data-status-over')
      );
      el.querySelectorAll('[data-active]').forEach((n) => n.removeAttribute('data-active'));
    }
    if (!id || id === afterStatusId) return;
    setStatusOrder((current) => {
      const next = current.filter((s) => s.id !== id);
      const dragged = current.find((s) => s.id === id);
      if (!dragged) return current;
      if (afterStatusId === null) {
        next.unshift(dragged);
      } else {
        const idx = next.findIndex((s) => s.id === afterStatusId);
        next.splice(idx + 1, 0, dragged);
      }
      return next;
    });
  }, []);

  return (
    <ScrollArea type="auto" className={classes.boardScroll} data-testid="task-board">
      <div ref={boardRef}>
        <Group align="stretch" gap="md" wrap="nowrap" className={classes.board}>
          {statusOrder.map((status) => (
            <BoardColumn
              key={status.id}
              status={status}
              tasks={grouped.get(status.id) || []}
              canWriteTasks={canWriteTasks}
              sortDir={sortDir}
              draggingTaskIdRef={draggingTaskIdRef}
              draggingStatusIdRef={draggingStatusIdRef}
              onAddTask={onAddTask}
              onOpenTask={onOpenTask}
              onMoveTask={onMoveTask}
              onTaskDragStart={handleTaskDragStart}
              onTaskDragEnd={handleTaskDragEnd}
              onStatusDragStart={handleStatusDragStart}
              onStatusDragEnd={handleStatusDragEnd}
              onStatusDrop={handleStatusDrop}
            />
          ))}
        </Group>
      </div>
    </ScrollArea>
  );
}
