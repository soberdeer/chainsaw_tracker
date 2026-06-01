import {
  ActionIcon,
  Box,
  Group,
  isLightColor,
  Text,
  Tooltip,
  useComputedColorScheme,
  useMantineTheme,
} from '@mantine/core';
import { IconChevronDown, IconChevronRight, IconGripVertical, IconPlus } from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { displayStatus, type Task, type TaskStatus } from '@/lib';
import { StatusIcon } from '../../StatusIcon/StatusIcon';
import { CompactTaskRow } from '../CompactTaskRow/CompactTaskRow';
import classes from './GroupedTaskList.module.css';

export interface GroupedTaskListProps {
  tasks: Task[];
  statuses: TaskStatus[];
  onAddTask: (statusId: string) => void;
  onOpenTask: (task: Task) => void;
  onMoveTask: (taskId: string, statusId: string, targetTaskId?: string | null) => void;
  onChanged: () => void;
  onError: (message: string) => void;
  canWriteTasks: boolean;
  selectedTaskIds?: Set<string>;
  onSelectedTaskChange?: (taskId: string, selected: boolean) => void;
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

// ── Pure DOM helpers (no React state — zero re-renders during drag) ─────────

function clearAllDropIndicators(container: Element) {
  container.querySelectorAll('[data-drop-before],[data-drop-after]').forEach((r) => {
    r.removeAttribute('data-drop-before');
    r.removeAttribute('data-drop-after');
  });
  container
    .querySelectorAll('[data-status-drop]')
    .forEach((r) => r.removeAttribute('data-status-drop'));
}

export function GroupedTaskList({
  tasks,
  statuses,
  onAddTask,
  onOpenTask,
  onMoveTask,
  onChanged,
  onError,
  canWriteTasks,
  selectedTaskIds,
  onSelectedTaskChange,
  sortDir = 'asc',
}: GroupedTaskListProps) {
  const theme = useMantineTheme();
  const computedTheme = useComputedColorScheme();
  const shade =
    typeof theme.primaryShade === 'object'
      ? theme.primaryShade[computedTheme as 'light' | 'dark']
      : theme.primaryShade;
  const [collapsedStatuses, setCollapsedStatuses] = useState<Set<string>>(() => new Set());

  const computedOrder = useMemo(() => computeStatusOrder(statuses, sortDir), [statuses, sortDir]);
  const [statusOrder, setStatusOrder] = useState<TaskStatus[]>(computedOrder);
  useEffect(() => {
    setStatusOrder(computeStatusOrder(statuses, sortDir));
  }, [statuses, sortDir]);

  // ── Drag refs — no React state during drag = no re-renders = reliable DnD ──
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingTaskIdRef = useRef<string | null>(null);
  const draggingStatusIdRef = useRef<string | null>(null);
  // Keep a stable ref to statusOrder so drop handlers can read it without stale closures
  const statusOrderRef = useRef<TaskStatus[]>(statusOrder);
  useEffect(() => {
    statusOrderRef.current = statusOrder;
  }, [statusOrder]);

  const toggleStatus = (statusId: string) => {
    setCollapsedStatuses((current) => {
      const next = new Set(current);
      if (next.has(statusId)) next.delete(statusId);
      else next.add(statusId);
      return next;
    });
  };

  // ── Status DnD ────────────────────────────────────────────────────────────
  const handleStatusDragStart = (statusId: string) => (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move';
    draggingStatusIdRef.current = statusId;
    const el = containerRef.current;
    if (!el) return;
    el.setAttribute('data-dragging-status', statusId);
    el.querySelector(`[data-status-wrapper="${statusId}"]`)?.classList.add(classes.statusDragging);
  };

  const handleStatusDragEnd = useCallback(() => {
    const id = draggingStatusIdRef.current;
    draggingStatusIdRef.current = null;
    const el = containerRef.current;
    if (!el) return;
    el.removeAttribute('data-dragging-status');
    if (id)
      el.querySelector(`[data-status-wrapper="${id}"]`)?.classList.remove(classes.statusDragging);
    clearAllDropIndicators(el);
  }, []);

  /** Reorder statuses: insert dragged status after `afterStatusId` (null = first position). */
  const applyStatusDrop = useCallback((afterStatusId: string | null) => {
    const id = draggingStatusIdRef.current;
    draggingStatusIdRef.current = null;
    const el = containerRef.current;
    if (el) {
      el.removeAttribute('data-dragging-status');
      if (id)
        el.querySelector(`[data-status-wrapper="${id}"]`)?.classList.remove(classes.statusDragging);
      clearAllDropIndicators(el);
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
        if (idx === -1) return current;
        next.splice(idx + 1, 0, dragged);
      }
      return next;
    });
  }, []);

  // ── Task DnD ──────────────────────────────────────────────────────────────
  const handleTaskDragStart = useCallback(
    (taskId: string) => () => {
      draggingTaskIdRef.current = taskId;
      containerRef.current?.setAttribute('data-dragging-task', '1');
    },
    []
  );

  const handleTaskDragEnd = useCallback(() => {
    draggingTaskIdRef.current = null;
    const el = containerRef.current;
    if (!el) return;
    el.removeAttribute('data-dragging-task');
    clearAllDropIndicators(el);
  }, []);

  const finishTaskDrop = useCallback(
    (taskId: string, toStatusId: string, targetTaskId: string | null) => {
      draggingTaskIdRef.current = null;
      const el = containerRef.current;
      if (el) {
        el.removeAttribute('data-dragging-task');
        clearAllDropIndicators(el);
      }
      onMoveTask(taskId, toStatusId, targetTaskId);
    },
    [onMoveTask]
  );

  return (
    <Box ref={containerRef as any} className={classes.taskList} data-testid="task-list">
      {statusOrder.map((status) => {
        const meta = displayStatus(status);
        // Do NOT re-sort here — the server already applies local board order;
        // re-sorting by task.position would undo both server ordering and
        // optimistic DnD updates.
        const groupTasks = tasks.filter(
          (task) => task.statusId === status.id || task.status === status.name
        );
        const isCollapsed = collapsedStatuses.has(status.id);

        return (
          <div key={status.id} data-status-wrapper={status.id}>
            <section
              className={classes.statusSection}
              data-status-id={status.id}
              // ── Status drag: dragover + drop on the section ───────────────
              onDragOver={(e) => {
                if (!canWriteTasks) return;
                const draggingStatus = draggingStatusIdRef.current;
                const draggingTask = draggingTaskIdRef.current;

                if (draggingStatus && draggingStatus !== status.id) {
                  e.preventDefault();
                  const wrapper = e.currentTarget.closest(
                    '[data-status-wrapper]'
                  ) as HTMLElement | null;
                  if (wrapper) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const isTop = e.clientY < rect.top + rect.height / 2;
                    wrapper.setAttribute('data-status-drop', isTop ? 'before' : 'after');
                  }
                } else if (draggingTask) {
                  // Allow the drop on the section (needed for empty columns / area below all rows)
                  e.preventDefault();
                }
              }}
              onDragLeave={(e) => {
                if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                const wrapper = e.currentTarget.closest(
                  '[data-status-wrapper]'
                ) as HTMLElement | null;
                wrapper?.removeAttribute('data-status-drop');
              }}
              onDrop={(e) => {
                if (!canWriteTasks) return;

                const draggingStatus = draggingStatusIdRef.current;
                if (draggingStatus && draggingStatus !== status.id) {
                  e.preventDefault();
                  const rect = e.currentTarget.getBoundingClientRect();
                  const isTop = e.clientY < rect.top + rect.height / 2;
                  const order = statusOrderRef.current;
                  const currentIdx = order.findIndex((s) => s.id === status.id);
                  const afterId = isTop
                    ? currentIdx === 0
                      ? null
                      : (order[currentIdx - 1]?.id ?? null)
                    : status.id;
                  const wrapper = e.currentTarget.closest(
                    '[data-status-wrapper]'
                  ) as HTMLElement | null;
                  wrapper?.removeAttribute('data-status-drop');
                  applyStatusDrop(afterId);
                  return;
                }

                // Task dropped on empty area (below all rows) → append to end
                const id = draggingTaskIdRef.current;
                if (id) {
                  e.preventDefault();
                  finishTaskDrop(id, status.id, null);
                }
              }}
            >
              <Group gap="sm" className={classes.statusHeading}>
                {canWriteTasks && (
                  <Tooltip label="Drag to reorder status">
                    <span
                      className={classes.statusGrip}
                      draggable
                      onDragStart={handleStatusDragStart(status.id)}
                      onDragEnd={handleStatusDragEnd}
                    >
                      <IconGripVertical size="1rem" />
                    </span>
                  </Tooltip>
                )}
                <Tooltip label={isCollapsed ? `Expand ${meta.label}` : `Collapse ${meta.label}`}>
                  <ActionIcon
                    variant="subtle"
                    aria-label={isCollapsed ? `Expand ${meta.label}` : `Collapse ${meta.label}`}
                    onClick={() => toggleStatus(status.id)}
                  >
                    {isCollapsed ? (
                      <IconChevronRight size="1rem" />
                    ) : (
                      <IconChevronDown size="1rem" />
                    )}
                  </ActionIcon>
                </Tooltip>
                <Tooltip label={`Status: ${meta.label}`}>
                  <Box
                    className={classes.statusPill}
                    style={{
                      background: `var(--mantine-color-${meta.tone}-${shade})`,
                      color: isLightColor(theme.colors[meta.tone][shade], 0.5) ? 'black' : 'white',
                    }}
                  >
                    <StatusIcon type={status.statusType} />
                    <span className={classes.statusPillName}>{meta.label}</span>
                  </Box>
                </Tooltip>
                <Text c="dimmed" fw={700}>
                  {groupTasks.length}
                </Text>
                {canWriteTasks && (
                  <Tooltip label={`Create task in ${meta.label}`}>
                    <ActionIcon
                      data-testid={`list-add-task-${status.id}`}
                      variant="subtle"
                      aria-label={`Create task in ${meta.label}`}
                      onClick={() => onAddTask(status.id)}
                    >
                      <IconPlus size="1.25rem" />
                    </ActionIcon>
                  </Tooltip>
                )}
              </Group>

              {!isCollapsed && (
                <>
                  <div className={classes.tableHead}>
                    <Text>Name</Text>
                    <Text>Assignee</Text>
                    <Text>Due date</Text>
                    <Text>Priority</Text>
                    <Text>Updated</Text>
                  </div>

                  {groupTasks.map((task, taskIndex) => (
                    <div
                      key={task.id}
                      data-task-row={task.id}
                      // ── Each row is its own drop target for precise positioning ──
                      onDragOver={(e) => {
                        if (!canWriteTasks || !draggingTaskIdRef.current) return;
                        if (draggingTaskIdRef.current === task.id) return; // skip self
                        e.preventDefault();
                        e.stopPropagation(); // don't let section handle this
                        const rect = e.currentTarget.getBoundingClientRect();
                        const isTop = e.clientY < rect.top + rect.height / 2;
                        const want = isTop ? 'data-drop-before' : 'data-drop-after';
                        const clear = isTop ? 'data-drop-after' : 'data-drop-before';
                        if (!e.currentTarget.hasAttribute(want)) {
                          // Clear all indicators in this status section first
                          e.currentTarget
                            .closest('section')
                            ?.querySelectorAll('[data-drop-before],[data-drop-after]')
                            .forEach((r) => {
                              r.removeAttribute('data-drop-before');
                              r.removeAttribute('data-drop-after');
                            });
                          e.currentTarget.setAttribute(want, '1');
                        }
                        e.currentTarget.removeAttribute(clear);
                      }}
                      onDragEnter={(e) => {
                        if (!canWriteTasks || !draggingTaskIdRef.current) return;
                        if (draggingTaskIdRef.current === task.id) return;
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onDragLeave={(e) => {
                        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                        e.currentTarget.removeAttribute('data-drop-before');
                        e.currentTarget.removeAttribute('data-drop-after');
                      }}
                      onDrop={(e) => {
                        if (!canWriteTasks) return;
                        const id = draggingTaskIdRef.current;
                        if (!id || id === task.id) return;
                        e.preventDefault();
                        e.stopPropagation();
                        e.currentTarget.removeAttribute('data-drop-before');
                        e.currentTarget.removeAttribute('data-drop-after');

                        const rect = e.currentTarget.getBoundingClientRect();
                        const isTop = e.clientY < rect.top + rect.height / 2;

                        let targetTaskId: string | null;
                        if (isTop) {
                          // Insert BEFORE this task
                          targetTaskId = task.id;
                        } else {
                          // Insert AFTER this task = before the next task (or end if last)
                          targetTaskId = groupTasks[taskIndex + 1]?.id ?? null;
                        }

                        finishTaskDrop(id, status.id, targetTaskId);
                      }}
                    >
                      <CompactTaskRow
                        task={task}
                        onOpen={onOpenTask}
                        onMove={(taskId) => onMoveTask(taskId, status.id)}
                        onChanged={onChanged}
                        onError={onError}
                        canWriteTasks={canWriteTasks}
                        selected={selectedTaskIds?.has(task.id)}
                        onSelectedChange={onSelectedTaskChange}
                        isDraggable={canWriteTasks}
                        onDragStart={handleTaskDragStart(task.id)}
                        onDragEnd={handleTaskDragEnd}
                      />
                    </div>
                  ))}

                  {canWriteTasks && (
                    <button
                      data-testid={`list-add-task-inline-${status.id}`}
                      className={classes.addTask}
                      type="button"
                      onClick={() => onAddTask(status.id)}
                    >
                      <IconPlus size="1.125rem" />
                      Add Task
                    </button>
                  )}
                </>
              )}
            </section>
          </div>
        );
      })}
    </Box>
  );
}
