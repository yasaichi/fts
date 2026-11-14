import {
  createMessageConnection,
  ErrorCodes,
  ResponseError,
  StreamMessageReader,
  StreamMessageWriter,
} from 'vscode-jsonrpc/node';
import { transformFutureTypeScript } from './transform.js';

const connection = createMessageConnection(
  new StreamMessageReader(process.stdin),
  new StreamMessageWriter(process.stdout),
);
const projects = new Set<string>();

connection.onRequest(
  'initialize',
  ({ positionEncodings }: { positionEncodings: string[] }) => {
    if (!positionEncodings.includes('utf-16')) {
      throw new ResponseError(
        ErrorCodes.InvalidParams,
        'FTS requires UTF-16 positions',
      );
    }
    return { diagnosticSource: 'fts', positionEncoding: 'utf-16' };
  },
);
connection.onRequest(
  'openProject',
  ({ projectHandle }: { projectHandle: string }) => {
    projects.add(projectHandle);
    return {};
  },
);
connection.onRequest(
  'transform',
  ({
    content,
    fileName,
    projectHandle,
  }: {
    content: string;
    fileName: string;
    projectHandle: string;
  }) => {
    if (!projects.has(projectHandle)) {
      throw new ResponseError(
        ErrorCodes.InvalidParams,
        'Unknown FTS project handle',
      );
    }
    return transformFutureTypeScript(content, fileName);
  },
);
connection.onRequest(
  'closeProject',
  ({ projectHandle }: { projectHandle: string }) => {
    projects.delete(projectHandle);
    return null;
  },
);
connection.listen();
process.stdin.on('end', () => connection.dispose());
