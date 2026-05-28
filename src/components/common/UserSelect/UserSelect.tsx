import {
  Avatar,
  Combobox,
  Group,
  Loader,
  Pill,
  PillsInput,
  ScrollArea,
  Text,
  Tooltip,
  useCombobox,
} from '@mantine/core';
import { useState } from 'react';
import type { User } from '@/lib';

export interface UserSelectProps {
  users: User[];
  loading?: boolean;
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
  maxValues?: number;
  label?: string;
  placeholder?: string;
  'data-testid'?: string;
}

export function UserSelect({
  users,
  loading = false,
  value,
  onChange,
  disabled = false,
  maxValues,
  label,
  placeholder = 'Assignee / responsible',
  'data-testid': testId,
}: UserSelectProps) {
  const [search, setSearch] = useState('');
  const combobox = useCombobox({
    onDropdownClose: () => {
      combobox.resetSelectedOption();
      setSearch('');
    },
  });

  const isMaxReached = maxValues !== undefined && value.length >= maxValues;

  const selectedUsers = value
    .map((id) => users.find((u) => u.id === id))
    .filter((u): u is User => Boolean(u));

  const filteredUsers = users.filter(
    (u) => !value.includes(u.id) && u.name.toLowerCase().includes(search.toLowerCase().trim())
  );

  const handleSelect = (userId: string) => {
    if (isMaxReached) return;
    onChange([...value, userId]);
    setSearch('');
  };

  const handleRemove = (userId: string) => {
    onChange(value.filter((id) => id !== userId));
  };

  const options = filteredUsers.map((user) => (
    <Combobox.Option value={user.id} key={user.id}>
      <Group gap="sm" wrap="nowrap">
        <Avatar
          src={user.avatarUrl || null}
          size="sm"
          radius="xl"
          color="initials"
          name={user.name}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <Text size="sm" truncate>
            {user.name}
          </Text>
          {user.email && (
            <Text size="xs" c="dimmed" truncate>
              {user.email}
            </Text>
          )}
        </div>
      </Group>
    </Combobox.Option>
  ));

  return (
    <Combobox store={combobox} onOptionSubmit={handleSelect} withinPortal>
      <Combobox.DropdownTarget>
        <PillsInput
          label={label}
          disabled={disabled}
          data-testid={testId}
          onClick={() => !disabled && combobox.openDropdown()}
          rightSection={loading ? <Loader size="xs" /> : null}
        >
          <Pill.Group>
            {selectedUsers.map((user) => (
              <Pill
                key={user.id}
                withRemoveButton={!disabled}
                onRemove={() => handleRemove(user.id)}
                styles={{ label: { display: 'flex', alignItems: 'center', gap: 4 } }}
              >
                <Tooltip label={user.email ? `${user.name} (${user.email})` : user.name} withArrow>
                  <Avatar
                    src={user.avatarUrl || null}
                    size={16}
                    radius="xl"
                    color="initials"
                    name={user.name}
                  />
                </Tooltip>
                <Text size="xs" component="span">
                  {user.name}
                </Text>
              </Pill>
            ))}
            <Combobox.EventsTarget>
              <PillsInput.Field
                placeholder={selectedUsers.length === 0 ? placeholder : undefined}
                value={search}
                onChange={(e) => {
                  setSearch(e.currentTarget.value);
                  combobox.openDropdown();
                  combobox.updateSelectedOptionIndex();
                }}
                onFocus={() => combobox.openDropdown()}
                onBlur={() => combobox.closeDropdown()}
                onKeyDown={(e) => {
                  if (e.key === 'Backspace' && search.length === 0 && value.length > 0) {
                    handleRemove(value[value.length - 1]);
                  }
                }}
                disabled={disabled || isMaxReached}
              />
            </Combobox.EventsTarget>
          </Pill.Group>
        </PillsInput>
      </Combobox.DropdownTarget>

      <Combobox.Dropdown>
        <Combobox.Options>
          <ScrollArea.Autosize mah={220} type="scroll">
            {loading ? (
              <Combobox.Empty>Loading…</Combobox.Empty>
            ) : options.length > 0 ? (
              options
            ) : (
              <Combobox.Empty>No users found</Combobox.Empty>
            )}
          </ScrollArea.Autosize>
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}
