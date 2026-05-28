import { useEffect, useRef, useState } from 'react';
import {
  getGitHubRepositories,
  getOpenProjectTags,
  getTaskActivity,
  getTaskAttachments,
  getTaskCustomFields,
  getTaskTags,
  getTaskTimeEntries,
  getTaskTimeEntryActivities,
  getErrorMessage,
  type ActivityLog,
  type GitHubRepository,
  type OpenProjectAttachmentItem,
  type OpenProjectCustomFieldItem,
  type OpenProjectTimeEntryActivityOption,
  type OpenProjectTimeEntryItem,
  type Tag,
  type Task,
} from '@/lib';

/**
 * Centralised data-loading hook for TaskDetailPage.
 * Loads all secondary data (activity, time, attachments, custom fields, tags, GitHub)
 * whenever `task` or `workspaceId` changes.
 */
export function useTaskDetailData(task: Task, workspaceId: string, onError: (msg: string) => void) {
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [timeEntries, setTimeEntries] = useState<OpenProjectTimeEntryItem[]>([]);
  const [totalHours, setTotalHours] = useState(0);
  const [timeEntryActivities, setTimeEntryActivities] = useState<
    OpenProjectTimeEntryActivityOption[]
  >([]);
  const [timeActivitiesError, setTimeActivitiesError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<OpenProjectAttachmentItem[]>([]);
  const [customFields, setCustomFields] = useState<OpenProjectCustomFieldItem[]>([]);
  const [workspaceTags, setWorkspaceTags] = useState<Tag[]>([]);
  const [taskTagIds, setTaskTagIds] = useState<string[]>([]);
  const [repositories, setRepositories] = useState<GitHubRepository[]>([]);

  // Keep a stable ref to the latest time-activity id so the form can default it
  const defaultTimeActivityIdRef = useRef<string>('');

  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    // Activity
    getTaskActivity(task.id)
      .then((page) => setActivity(page.items))
      .catch((error) => onErrorRef.current(getErrorMessage(error)));

    // Time entries
    getTaskTimeEntries(task.id)
      .then((page) => {
        setTimeEntries(page.items);
        setTotalHours(page.totalHours);
      })
      .catch(() => {
        setTimeEntries([]);
        setTotalHours(0);
      });

    // Time entry activities
    getTaskTimeEntryActivities()
      .then(({ items }) => {
        setTimeEntryActivities(items);
        setTimeActivitiesError(
          items.length ? null : 'OpenProject did not return any time entry activities.'
        );
        defaultTimeActivityIdRef.current = items.length === 1 ? (items[0]?.id ?? '') : '';
      })
      .catch((error) => {
        setTimeEntryActivities([]);
        setTimeActivitiesError(getErrorMessage(error));
        defaultTimeActivityIdRef.current = '';
      });

    // Attachments
    getTaskAttachments(task.id)
      .then((page) => setAttachments(page.items))
      .catch(() => setAttachments([]));

    // Custom fields
    getTaskCustomFields(task.id)
      .then((page) => setCustomFields(page.items))
      .catch(() => setCustomFields([]));

    // Tags
    Promise.all([getOpenProjectTags(workspaceId), getTaskTags(task.id)])
      .then(([tags, page]) => {
        setWorkspaceTags(tags);
        setTaskTagIds(page.items.map((item) => item.id));
      })
      .catch((error) => {
        setWorkspaceTags([]);
        setTaskTagIds([]);
        onErrorRef.current(getErrorMessage(error));
      });

    // GitHub repositories
    getGitHubRepositories(workspaceId)
      .then((items) => setRepositories(items))
      .catch(() => setRepositories([]));
  }, [task.id, workspaceId]);

  const refreshActivity = () =>
    getTaskActivity(task.id)
      .then((page) => setActivity(page.items))
      .catch((error) => onErrorRef.current(getErrorMessage(error)));

  const refreshTimeEntries = () =>
    getTaskTimeEntries(task.id).then((page) => {
      setTimeEntries(page.items);
      setTotalHours(page.totalHours);
    });

  const refreshAttachments = () =>
    getTaskAttachments(task.id)
      .then((page) => setAttachments(page.items))
      .catch(() => setAttachments([]));

  return {
    activity,
    timeEntries,
    totalHours,
    timeEntryActivities,
    timeActivitiesError,
    defaultTimeActivityId: defaultTimeActivityIdRef.current,
    attachments,
    customFields,
    setCustomFields,
    workspaceTags,
    setWorkspaceTags,
    taskTagIds,
    setTaskTagIds,
    repositories,
    refreshActivity,
    refreshTimeEntries,
    refreshAttachments,
  };
}
