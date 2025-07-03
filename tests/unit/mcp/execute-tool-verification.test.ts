/**
 * Execute-in-Context Tool Verification Test
 * @module tests/unit/mcp/execute-tool-verification
 * @description Simple verification that the execute-in-context tool was added correctly
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Execute-in-Context Tool Implementation', () => {
  it('should have the execute-in-context tool defined in the tools array', () => {
    // Read the server.ts file
    const serverPath = join(__dirname, '../../../src/mcp/server.ts');
    const serverContent = readFileSync(serverPath, 'utf-8');

    // Check that the tool is defined in the tools array
    expect(serverContent).toContain("name: 'execute-in-context'");
    expect(serverContent).toContain("description: 'Execute commands in a browser context'");
    expect(serverContent).toContain(
      "contextId: { type: 'string', description: 'Context ID to execute command in' }",
    );
    expect(serverContent).toContain(
      "command: { type: 'string', description: 'Command to execute' }",
    );
    expect(serverContent).toContain(
      "parameters: { type: 'object', description: 'Parameters for the command' }",
    );
    expect(serverContent).toContain("required: ['contextId', 'command']");
  });

  it('should have a case for execute-in-context in the tool handler switch', () => {
    const serverPath = join(__dirname, '../../../src/mcp/server.ts');
    const serverContent = readFileSync(serverPath, 'utf-8');

    // Check that the case is in the switch statement
    expect(serverContent).toContain("case 'execute-in-context':");
    expect(serverContent).toContain('return await this.executeInContextTool(args);');
  });

  it('should have the executeInContextTool method implemented', () => {
    const serverPath = join(__dirname, '../../../src/mcp/server.ts');
    const serverContent = readFileSync(serverPath, 'utf-8');

    // Check that the method exists
    expect(serverContent).toContain('private async executeInContextTool(args: any): Promise<any>');
    expect(serverContent).toContain('Execute in context tool');
    expect(serverContent).toContain('@nist ac-3');
    expect(serverContent).toContain('@nist au-3');

    // Check key parts of the implementation
    expect(serverContent).toContain('if (!args.contextId)');
    expect(serverContent).toContain('if (!args.command)');
    expect(serverContent).toContain('this.restAdapter.executeRequest');
    expect(serverContent).toContain('endpoint: `/v1/contexts/${args.contextId}/execute`');
    expect(serverContent).toContain('action: args.command');
    expect(serverContent).toContain('params: args.parameters || {}');
  });
});
