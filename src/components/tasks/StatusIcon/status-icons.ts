import {
  IconCircle,
  IconCircleCheck,
  IconCircleCheckFilled,
  IconCircleDashed,
  IconCircleDotted,
  IconNoiseReduction,
} from '@tabler/icons-react';

export const statusIcons = {
  open: {
    icon: IconCircleDashed,
    isDone: false,
    color: 'gray',
  },
  prep: {
    icon: IconCircleDotted,
    isDone: false,
    color: 'blue',
  },
  progress: {
    icon: IconNoiseReduction,
    isDone: false,
    color: 'grape',
  },
  test: {
    icon: IconCircle,
    isDone: false,
    color: 'cyan',
  },
  done: {
    icon: IconCircleCheckFilled,
    isDone: true,
    color: 'green',
  },
  closed: {
    icon: IconCircleCheck,
    isDone: true,
    color: 'gray',
  },
};
