import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import {
  createMessageConnection,
  StreamMessageReader,
  StreamMessageWriter,
} from 'vscode-jsonrpc/node';

const repository = fileURLToPath(new URL('../../../', import.meta.url));
export const tsc = fileURLToPath(
  new URL('../../../node_modules/typescript/bin/tsc', import.meta.url),
);

export function startConnection(command: string, args: string[]) {
  const process = spawn(command, args, {
    cwd: repository,
    stdio: ['pipe', 'pipe', 'ignore'],
  });
  const connection = createMessageConnection(
    new StreamMessageReader(process.stdout),
    new StreamMessageWriter(process.stdin),
  );
  connection.listen();
  return {
    connection,
    async stop() {
      connection.dispose();
      if (process.exitCode === null && process.signalCode === null) {
        const exited = once(process, 'exit');
        process.kill();
        await exited;
      }
    },
  };
}
