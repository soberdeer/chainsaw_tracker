import { ActionIcon, Box, Group, Tooltip, UnstyledButton } from '@mantine/core';
import { IconChevronDown, IconChevronRight, IconPlus, IconUsers } from '@tabler/icons-react';
import { firstTaskFolder, type Space } from '@/lib';
import { FolderTreeItem } from './FolderTreeItem';
import { useWorkspaceShellContext } from './WorkspaceShellContext';
import classes from './WorkspaceShell.module.css';

interface SpaceTreeItemProps {
  space: Space;
}

export function SpaceTreeItem({ space }: SpaceTreeItemProps) {
  const state = useWorkspaceShellContext();
  const isActiveSpace = space.id === state.activeSpace?.id;
  const isExpanded = state.expandedSpaceIds.has(space.id);

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
            state.toggleSpace(space.id);
            if (!isActiveSpace) {
              const folder = firstTaskFolder(space) ?? space.folders[0];
              if (folder) {
                state.openFolder(space.id, folder);
                state.closeMobileNav();
              }
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
        {isActiveSpace && (
          <Tooltip label="Project access">
            <ActionIcon
              variant="subtle"
              aria-label="Project access"
              className={classes.rowAction}
              onClick={(e) => {
                e.stopPropagation();
                state.setProjectAccessOpen(true);
              }}
            >
              <IconUsers size="1.125rem" />
            </ActionIcon>
          </Tooltip>
        )}
        {isActiveSpace && state.canManageSpaces && (
          <Tooltip label="Create sub-project">
            <ActionIcon
              variant="subtle"
              aria-label="Create sub-project"
              className={classes.rowAction}
              onClick={(e) => {
                e.stopPropagation();
                state.setSubProjectParentId(space.id);
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
            <FolderTreeItem key={folder.id} spaceId={space.id} folder={folder} />
          ))}
        </Box>
      )}
    </Box>
  );
}
