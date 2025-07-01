/**
 * Command execution service for contexts
 * @module grpc/services/command-executor
 * @nist ac-3 "Access enforcement"
 * @nist si-10 "Information input validation"
 * @nist au-3 "Content of audit records"
 */

import { spawn } from 'child_process';
import * as grpc from '@grpc/grpc-js';
import { pino } from 'pino';
import { logSecurityEvent, SecurityEventType } from '../../utils/logger.js';
import {
  validateRequiredField,
  checkContextAccess,
  validateCommandContext,
} from './context-helpers.js';
import type { Context } from './context.service.js';
import type { AuthenticatedServerUnaryCall, AuthenticatedServerWritableStream } from '../interceptors/types.js';
import type { ExecuteCommandRequest, ExecuteCommandResponse } from '../types/context.types.js';

export class CommandExecutor {
  constructor(private logger: pino.Logger) {}

  /**
   * Execute command in context
   * @nist ac-3 "Access enforcement"
   * @nist si-10 "Information input validation"
   * @nist au-3 "Content of audit records"
   */
  async executeCommand(
    call: AuthenticatedServerUnaryCall<ExecuteCommandRequest, ExecuteCommandResponse>,
    callback: grpc.sendUnaryData<ExecuteCommandResponse>,
    context: Context
  ): Promise<void> {
    try {
      const { command, args, env, working_dir, timeout_seconds } = call.request;

      validateRequiredField(command, 'Command');
      checkContextAccess(context, call.userId, call.roles);
      validateCommandContext(context);

      // Log command execution attempt
      await logSecurityEvent(SecurityEventType.COMMAND_EXECUTED, {
        resource: `context:${context.id}`,
        action: 'execute_command',
        result: 'success',
        metadata: {
          userId: call.userId,
          command,
          args: args?.join(' '),
        },
      });

      // Execute command with timeout
      const timeout = (timeout_seconds ?? 30) * 1000;
      const startTime = Date.now();

      const child = spawn(command, args ?? [], {
        env: { ...process.env, ...env },
        cwd: working_dir ?? process.cwd(),
        timeout,
      });

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('error', (error) => {
        this.logger.error('Command execution error:', error);
        callback(error as grpc.ServiceError);
      });

      child.on('close', (code) => {
        void (async () => {
        const duration = Date.now() - startTime;

        // Log command completion
        await logSecurityEvent(SecurityEventType.COMMAND_EXECUTED, {
          resource: `context:${context.id}`,
          action: 'execute_command',
          result: code === 0 ? 'success' : 'failure',
          metadata: {
            userId: call.userId,
            command,
            exitCode: code,
            duration,
            timedOut,
          },
        });

          callback(null, {
            output: stdout,
            exit_code: code ?? 0,
            error: stderr || undefined,
          });
        })();
      });

      // Handle timeout
      setTimeout(() => {
        if (child.exitCode === null) {
          timedOut = true;
          child.kill('SIGTERM');
        }
      }, timeout);
    } catch (error) {
      callback(error as grpc.ServiceError);
    }
  }

  /**
   * Stream command execution
   * @nist ac-3 "Access enforcement"
   * @nist si-10 "Information input validation"
   */
  streamCommand(
    call: AuthenticatedServerWritableStream<ExecuteCommandRequest, ExecuteCommandResponse>,
    context: Context
  ): void {
    try {
      const { command, args, env, working_dir } = call.request;

      validateRequiredField(command, 'Command');
      checkContextAccess(context, call.userId, call.roles);

      // Execute command
      const child = spawn(command, args ?? [], {
        env: { ...process.env, ...env },
        cwd: working_dir ?? process.cwd(),
      });

      child.stdout.on('data', (data) => {
        call.write({ stdout: data.toString() });
      });

      child.stderr.on('data', (data) => {
        call.write({ stderr: data.toString() });
      });

      child.on('error', (error) => {
        call.write({
          error: `COMMAND_ERROR: ${error.message}`,
        });
        call.end();
      });

      child.on('close', (code) => {
        call.write({ 
          output: '',
          exit_code: code ?? 0 
        });
        call.end();
      });

      // Handle stream cancellation
      call.on('cancelled', () => {
        child.kill('SIGTERM');
      });
    } catch (error) {
      this.logger.error('Error in streamCommand:', error);
      call.emit('error', error);
    }
  }
}