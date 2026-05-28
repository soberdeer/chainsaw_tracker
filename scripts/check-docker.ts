import { execFileSync } from 'node:child_process';

function run(command: string, args: string[]) {
  return execFileSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function commandExists(command: string) {
  try {
    run('which', [command]);
    return true;
  } catch {
    return false;
  }
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

if (!commandExists('docker')) {
  fail(
    [
      'Docker CLI is not installed or is not available in PATH.',
      'Install Docker Desktop or install docker + colima, then try again.',
    ].join('\n')
  );
}

try {
  run('docker', ['info']);
  console.log('Docker daemon is available.');
  process.exit(0);
} catch (error) {
  const message =
    error instanceof Error
      ? `${error.message}\n${String((error as { stderr?: string }).stderr || '')}`
      : String(error);

  const context = (() => {
    try {
      return run('docker', ['context', 'show']);
    } catch {
      return 'unknown';
    }
  })();

  const colimaInstalled = commandExists('colima');
  const colimaStatus = (() => {
    if (!colimaInstalled) {
      return null;
    }
    try {
      return run('colima', ['status']);
    } catch {
      return null;
    }
  })();

  const hints = ['Docker daemon is not reachable.', `Current docker context: ${context}`];

  if (message.includes('.colima') || context === 'colima') {
    hints.push('');
    hints.push('It looks like Docker is configured to use Colima.');
    if (!colimaInstalled) {
      hints.push('Install Colima first: brew install colima docker');
    } else if (colimaStatus !== 'Running') {
      hints.push('Start Colima and try again:');
      hints.push('  colima start');
    }
  } else {
    hints.push('');
    hints.push('If you use Docker Desktop, make sure the app is running.');
    hints.push('Then verify the active context:');
    hints.push('  docker context ls');
    hints.push('  docker context use default');
  }

  hints.push('');
  hints.push('Raw docker error:');
  hints.push(message.trim());

  fail(hints.join('\n'));
}
