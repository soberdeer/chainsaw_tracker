import { ProfileModal } from '../../auth/ProfileModal/ProfileModal';
import { GlobalSearchModal } from '../../search/GlobalSearchModal/GlobalSearchModal';
import { TaskCreateModal } from '../../tasks/TaskCreateModal';
import { ImportReportModal } from '../ImportReportModal/ImportReportModal';
import { ProjectAccessModal } from '../ProjectAccessModal/ProjectAccessModal';
import { SpaceCreateModal } from '../SpaceCreateModal/SpaceCreateModal';
import { WorkspaceSettingsModal } from '../WorkspaceSettingsModal/WorkspaceSettingsModal';
import { useWorkspaceShellContext } from './WorkspaceShellContext';

export function WorkspaceShellModals() {
  const state = useWorkspaceShellContext();

  return (
    <>
      <GlobalSearchModal
        opened={state.searchOpen}
        workspace={state.workspace}
        activeSpace={state.activeSpace}
        activeFolder={state.activeFolder}
        activeTaskList={state.activeTaskList}
        onClose={() => state.setSearchOpen(false)}
        onNavigate={state.navigateTo}
        onCreateTask={() => state.setCreateTaskStatusId(state.statuses[0]?.id || null)}
        onCreateSpace={() => state.setSpaceCreateOpen(true)}
        onError={state.setActionError}
        canManageSpaces={state.canManageSpaces}
        canWriteTasks={state.canWriteTasks}
      />
      <TaskCreateModal
        opened={Boolean(state.createTaskStatusId)}
        taskList={state.activeTaskList}
        statuses={state.statuses}
        users={
          state.activeTaskListUsers.length > 0
            ? state.activeTaskListUsers
            : state.availableAssignees
        }
        usersLoading={state.activeTaskListUsersLoading}
        initialStatusId={state.createTaskStatusId || state.statuses[0]?.id}
        onClose={() => state.setCreateTaskStatusId(null)}
        onCreated={state.reload}
        onError={state.setActionError}
      />
      <ProfileModal
        opened={state.profileOpen}
        user={state.currentUser}
        role={state.currentMembership?.role}
        onClose={() => state.setProfileOpen(false)}
        onSaved={state.onCurrentUserChange}
        onOpenAssignedToMe={state.openAssignedToMe}
      />
      {state.workspace && (
        <WorkspaceSettingsModal
          opened={state.workspaceSettingsOpen}
          workspaceId={state.workspace.id}
          currentRole={state.currentMembership?.role}
          canManageWorkspace={state.canManageWorkspace}
          initialTab={state.workspaceSettingsTab}
          onClose={() => state.setWorkspaceSettingsOpen(false)}
          onUpdated={state.reload}
          onOpenImportReport={state.openImportReport}
        />
      )}
      {state.workspace && state.activeSpace && (
        <ProjectAccessModal
          opened={state.projectAccessOpen}
          workspaceId={state.workspace.id}
          projectId={state.activeSpace.id}
          projectName={state.activeSpace.name}
          onClose={() => state.setProjectAccessOpen(false)}
        />
      )}
      {state.workspace && (
        <SpaceCreateModal
          opened={state.spaceCreateOpen}
          workspace={state.workspace}
          onClose={() => state.setSpaceCreateOpen(false)}
          onCreated={state.reload}
        />
      )}
      {state.workspace && (
        <SpaceCreateModal
          opened={state.subProjectParentId !== null}
          workspace={state.workspace}
          initialParentId={state.subProjectParentId ?? undefined}
          onClose={() => state.setSubProjectParentId(null)}
          onCreated={state.reload}
        />
      )}
      <ImportReportModal
        report={state.activeImportReport}
        onClose={() => state.setActiveImportReport(null)}
      />
    </>
  );
}
