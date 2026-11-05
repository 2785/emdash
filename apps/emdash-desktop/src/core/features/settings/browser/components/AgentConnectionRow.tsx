import { Button, toast } from '@emdash/ui/react/primitives';
import { Copy } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { getWorkspaceControlClient } from '@core/features/workspace-control/api/browser/client';
import type { AgentConnection } from '@core/features/workspace-control/api/contract';
import { PRODUCT_NAME } from '@core/primitives/app-identity/api/app-identity';
import { copyTextToClipboard } from '@core/primitives/desktop-host/browser/host-client';
import { SettingRow } from './SettingRow';

const quote = (arg: string) =>
  /^[\w./=:@-]+$/.test(arg) ? arg : `'${arg.replace(/'/g, `'\\''`)}'`;

/** Copyable command that connects an MCP client outside the app to workspace control. */
export const AgentConnectionRow: React.FC = () => {
  const [connection, setConnection] = useState<AgentConnection | null>(null);

  useEffect(() => {
    void getWorkspaceControlClient()
      .then((client) => client.connection(undefined))
      .then(setConnection);
  }, []);

  if (!connection?.available) return null;
  const command = `claude mcp add --scope user emjosh -- ${connection.command.map(quote).join(' ')}`;

  return (
    <SettingRow
      title="Connect an external agent"
      description={`Lets an agent running outside ${PRODUCT_NAME} (e.g. claude in a terminal) list, create, and archive workspaces and use initiatives, while ${PRODUCT_NAME} is open. Run this once to add it to Claude Code; other MCP clients can run the same command as a stdio server.`}
      control={
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void copyTextToClipboard(command).then(() => toast('Command copied'))}
        >
          <Copy className="size-4" />
          Copy command
        </Button>
      }
    />
  );
};
