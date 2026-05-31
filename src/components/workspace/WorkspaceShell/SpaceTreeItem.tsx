import { ActionIcon, Box, Group, Tooltip, UnstyledButton } from '@mantine/core';
import { IconChevronDown, IconChevronRight, IconPlus } from '@tabler/icons-react';
import { firstTaskFolder, type Folder, type Space } from '@/lib';
import { FolderTreeItem } from './FolderTreeItem';
import classes from './WorkspaceShell.module.css';

interface SpaceTreeItemProps {
  space: Space;
  activeSpace: Space | undefined;
  activeFolder: Folder | undefined;
  expandedSpaceIds: Set<string>;
  expandedFolderIds: Set<string>;
  canManageSpaces?: boolean;
  onToggleSpace: (id: string) => void;
  onOpenFolder: (spaceId: string, folder: Folder) => void;
  onToggleFolder: (id: string) => void;
  onOpenProjectAccess?: () => void;
  onCreateSubProject: (parentSpaceId: string) => void;
}

export function SpaceTreeItem({
  space,
  activeSpace,
  activeFolder,
  expandedSpaceIds,
  expandedFolderIds,
  canManageSpaces,
  onToggleSpace,
  onOpenFolder,
  onToggleFolder,
  onOpenProjectAccess: _onOpenProjectAccess,
  onCreateSubProject,
}: SpaceTreeItemProps) {
  const isActiveSpace = space.id === activeSpace?.id;
  const isExpanded = expandedSpaceIds.has(space.id);

  return (
    <Box className={classes.spaceTreeBlock}>
      <Group wrap="nowrap" gap={0}>
        <UnstyledButton
          data-testid="project-link"
          data-project-id={space.id}
          className={
            isActiveSpace ? `${classes.spaceTreeRow} ${classes.active}` : classes.spaceTreeRow
          }
          onClick={() => {
            onToggleSpace(space.id);
            if (!isActiveSpace) {
              const folder = firstTaskFolder(space) ?? space.folders[0];
              if (folder) onOpenFolder(space.id, folder);
            }
          }}
        >
          <span className={classes.treeCaret}>
            {isExpanded ? (
              <IconChevronDown size="0.875rem" />
            ) : (
              <IconChevronRight size="0.875rem" />
            )}
          </span>
          <span className={classes.spaceInitial} style={{ background: space.color }}>
            {space.initials || space.name.slice(0, 1)}
          </span>
          <span className={classes.spaceName}>{space.name}</span>
        </UnstyledButton>
        {isActiveSpace && canManageSpaces && (
          <Tooltip label="Create sub-project">
            <ActionIcon
              variant="subtle"
              aria-label="Create sub-project"
              className={classes.rowAction}
              onClick={(e) => {
                e.stopPropagation();
                onCreateSubProject(space.id);
              }}
            >
              <IconPlus size="1.125rem" />
            </ActionIcon>
          </Tooltip>
        )}
      </Group>
      {isExpanded && (
        <Box className={classes.folderTree}>
          {space.folders.map((folder) => (
            <FolderTreeItem
              key={folder.id}
              spaceId={space.id}
              folder={folder}
              activeFolder={activeFolder}
              expandedFolderIds={expandedFolderIds}
              onOpenFolder={onOpenFolder}
              onToggleFolder={onToggleFolder}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}
