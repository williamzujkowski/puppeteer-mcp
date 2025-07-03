/**
 * Execute-in-Context Tool Verification Test
 * @module tests/unit/mcp/execute-tool-verification
 * @description Simple verification that the execute-in-context tool was added correctly
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Execute-in-Context Tool Implementation', () => {
  it('should have the execute-in-context tool defined in the tool definitions', () => {
    // Read the tool definitions file
    const toolDefinitionsPath = join(process.cwd(), 'src/mcp/tools/tool-definitions.ts');
    const toolDefinitionsContent = readFileSync(toolDefinitionsPath, 'utf-8');

    // Check that the tool is defined in the TOOL_DEFINITIONS array
    expect(toolDefinitionsContent).toContain("name: 'execute-in-context'");
    expect(toolDefinitionsContent).toContain(
      "description: 'Execute commands in a browser context'",
    );
    expect(toolDefinitionsContent).toContain(
      "contextId: { type: 'string', description: 'Context ID to execute command in' }",
    );
    expect(toolDefinitionsContent).toContain(
      "command: { type: 'string', description: 'Command to execute' }",
    );
    expect(toolDefinitionsContent).toContain(
      "parameters: { type: 'object', description: 'Parameters for the command' }",
    );
    expect(toolDefinitionsContent).toContain("required: ['contextId', 'command']");
  });

  it('should have the ExecuteInContextTool class implemented', () => {
    const toolClassPath = join(process.cwd(), 'src/mcp/tools/execute-in-context.ts');
    const toolClassContent = readFileSync(toolClassPath, 'utf-8');

    // Check that the class exists with proper NIST compliance
    expect(toolClassContent).toContain('export class ExecuteInContextTool');
    expect(toolClassContent).toContain('@nist ac-3');
    expect(toolClassContent).toContain('@nist au-3');

    // Check key methods exist
    expect(toolClassContent).toContain('async execute(args: ExecuteInContextArgs)');
    expect(toolClassContent).toContain('private validateArgs(args: ExecuteInContextArgs)');
    expect(toolClassContent).toContain('private async executeCommand(args: ExecuteInContextArgs)');
  });

  it('should have a case for execute-in-context in the tool handler switch', () => {
    const serverPath = join(process.cwd(), 'src/mcp/server.ts');
    const serverContent = readFileSync(serverPath, 'utf-8');

    // Check that the case is in the switch statement
    expect(serverContent).toContain("case 'execute-in-context':");
    expect(serverContent).toContain('this.executeInContextTool.execute');
  });

  it('should have proper input validation and REST adapter integration', () => {
    const toolClassPath = join(process.cwd(), 'src/mcp/tools/execute-in-context.ts');
    const toolClassContent = readFileSync(toolClassPath, 'utf-8');

    // Check key implementation details
    expect(toolClassContent).toContain('if (!args.contextId)');
    expect(toolClassContent).toContain('if (!args.command)');
    expect(toolClassContent).toContain('this.restAdapter.executeRequest');
    expect(toolClassContent).toContain('endpoint: `/v1/contexts/${args.contextId}/execute`');
    expect(toolClassContent).toContain('action: args.command');
    expect(toolClassContent).toContain('params: args.parameters');
  });
});
