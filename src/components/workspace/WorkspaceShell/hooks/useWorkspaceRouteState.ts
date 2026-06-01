import { useLocation, useMatch, useParams } from 'react-router-dom';

export function useWorkspaceRouteState() {
  const location = useLocation();
  const {
    spaceId: routeSpaceId,
    folderId: routeFolderId,
    taskId: routeTaskId,
    docId: routeDocId,
  } = useParams<{
    spaceId?: string;
    folderId?: string;
    taskId?: string;
    docId?: string;
  }>();

  const isAllTasksRoute = Boolean(useMatch('/tasks'));
  const isMyTasksRoute = Boolean(useMatch('/my-tasks'));
  const isDocsRoute = Boolean(useMatch('/space/:spaceId/docs'));
  const isDocRoute = Boolean(useMatch('/space/:spaceId/docs/:docId'));
  const isFolderRoute = Boolean(routeSpaceId && routeFolderId);
  const workspaceWideScope = isAllTasksRoute ? 'all' : isMyTasksRoute ? 'mine' : null;

  return {
    location,
    routeSpaceId,
    routeFolderId,
    routeTaskId,
    routeDocId,
    isDocsRoute,
    isDocRoute,
    isFolderRoute,
    workspaceWideScope,
  };
}
