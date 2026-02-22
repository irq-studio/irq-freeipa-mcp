/**
 * SSH Manager for Remote Command Execution
 * Handles SSH connections to remote hosts for SSSD cache management
 */

import { Client } from 'ssh2';
import { SSHConfig, SSHCommandResult, SSHError } from './types.js';
import { config as appConfig } from './config.js';

/**
 * Validate a string is safe for shell interpolation.
 * Only allows alphanumeric characters, dots, hyphens, underscores, and @.
 */
function validateShellSafe(value: string, name: string): string {
  if (typeof value !== 'string' || !value) {
    throw new SSHError(`${name} is required`);
  }
  if (!/^[a-zA-Z0-9._@-]+$/.test(value)) {
    throw new SSHError(`${name} contains unsafe characters: ${value}`);
  }
  return value;
}

export class SSHManager {
  private username: string;
  private password: string;
  private defaultPort: number;
  private defaultTimeout: number;
  private sssdDomain: string;

  constructor(config?: Partial<SSHConfig>) {
    this.username = config?.username || appConfig.ssh.username;
    this.password = config?.password || appConfig.ssh.password;
    this.defaultPort = config?.port || appConfig.ssh.port;
    this.defaultTimeout = appConfig.ssh.timeout;
    this.sssdDomain = appConfig.sssd.domain;
  }

  /**
   * Execute a command on a remote host via SSH
   */
  async executeCommand(host: string, command: string, port?: number): Promise<SSHCommandResult> {
    return new Promise((resolve, reject) => {
      const conn = new Client();
      let stdout = '';
      let stderr = '';

      conn.on('ready', () => {
        conn.exec(command, (err, stream) => {
          if (err) {
            conn.end();
            reject(new SSHError(`Failed to execute command: ${err.message}`, host));
            return;
          }

          stream.on('close', (code: number) => {
            conn.end();
            resolve({
              stdout: stdout.trim(),
              stderr: stderr.trim(),
              exitCode: code
            });
          });

          stream.on('data', (data: Buffer) => {
            stdout += data.toString();
          });

          stream.stderr.on('data', (data: Buffer) => {
            stderr += data.toString();
          });
        });
      });

      conn.on('error', (err) => {
        reject(new SSHError(`SSH connection failed: ${err.message}`, host));
      });

      conn.connect({
        host,
        port: port || this.defaultPort,
        username: this.username,
        password: this.password,
        readyTimeout: this.defaultTimeout
      });
    });
  }

  /**
   * Execute a command on multiple hosts in parallel
   */
  async executeOnMultipleHosts(
    hosts: string[],
    command: string
  ): Promise<Map<string, SSHCommandResult>> {
    const results = new Map<string, SSHCommandResult>();

    const promises = hosts.map(async (host) => {
      try {
        const result = await this.executeCommand(host, command);
        results.set(host, result);
      } catch (error: any) {
        results.set(host, {
          stdout: '',
          stderr: error.message,
          exitCode: -1
        });
      }
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Clear SSSD cache on a host
   */
  async clearSSSDCache(host: string, force: boolean = false): Promise<SSHCommandResult> {
    const commands = [
      'sudo systemctl stop sssd',
      'sudo rm -rf /var/lib/sss/db/*',
      'sudo systemctl start sssd',
      force ? 'sudo sss_cache -E' : ''
    ].filter(Boolean).join(' && ');

    return this.executeCommand(host, commands);
  }

  /**
   * Clear SSSD cache on multiple hosts
   */
  async clearSSSDCacheMultiple(hosts: string[], force: boolean = false): Promise<Map<string, SSHCommandResult>> {
    const commands = [
      'sudo systemctl stop sssd',
      'sudo rm -rf /var/lib/sss/db/*',
      'sudo systemctl start sssd',
      force ? 'sudo sss_cache -E' : ''
    ].filter(Boolean).join(' && ');

    return this.executeOnMultipleHosts(hosts, commands);
  }

  /**
   * Update SSSD cache timeout settings
   */
  async updateSSSDTimeout(
    host: string,
    entryCacheTimeout: number = 300,
    sudoTimeout: number = 300
  ): Promise<SSHCommandResult> {
    if (!Number.isInteger(entryCacheTimeout) || entryCacheTimeout < 0) {
      throw new SSHError('entryCacheTimeout must be a non-negative integer');
    }
    if (!Number.isInteger(sudoTimeout) || sudoTimeout < 0) {
      throw new SSHError('sudoTimeout must be a non-negative integer');
    }
    // Escape domain name for sed regex
    const escapedDomain = this.sssdDomain.replace(/\./g, '\\.');
    const commands = [
      `sudo sed -i '/^entry_cache_timeout/d' /etc/sssd/sssd.conf`,
      `sudo sed -i '/^entry_cache_sudo_timeout/d' /etc/sssd/sssd.conf`,
      `sudo sed -i '/\\[domain\\/${escapedDomain}\\]/a entry_cache_timeout = ${entryCacheTimeout}' /etc/sssd/sssd.conf`,
      `sudo sed -i '/\\[domain\\/${escapedDomain}\\]/a entry_cache_sudo_timeout = ${sudoTimeout}' /etc/sssd/sssd.conf`,
      'sudo systemctl restart sssd'
    ].join(' && ');

    return this.executeCommand(host, commands);
  }

  /**
   * Update SSSD cache timeout on multiple hosts
   */
  async updateSSSDTimeoutMultiple(
    hosts: string[],
    entryCacheTimeout: number = 300,
    sudoTimeout: number = 300
  ): Promise<Map<string, SSHCommandResult>> {
    if (!Number.isInteger(entryCacheTimeout) || entryCacheTimeout < 0) {
      throw new SSHError('entryCacheTimeout must be a non-negative integer');
    }
    if (!Number.isInteger(sudoTimeout) || sudoTimeout < 0) {
      throw new SSHError('sudoTimeout must be a non-negative integer');
    }
    // Escape domain name for sed regex
    const escapedDomain = this.sssdDomain.replace(/\./g, '\\.');
    const commands = [
      `sudo sed -i '/^entry_cache_timeout/d' /etc/sssd/sssd.conf`,
      `sudo sed -i '/^entry_cache_sudo_timeout/d' /etc/sssd/sssd.conf`,
      `sudo sed -i '/\\[domain\\/${escapedDomain}\\]/a entry_cache_timeout = ${entryCacheTimeout}' /etc/sssd/sssd.conf`,
      `sudo sed -i '/\\[domain\\/${escapedDomain}\\]/a entry_cache_sudo_timeout = ${sudoTimeout}' /etc/sssd/sssd.conf`,
      'sudo systemctl restart sssd'
    ].join(' && ');

    return this.executeOnMultipleHosts(hosts, commands);
  }

  /**
   * Check SSSD service status on a host
   */
  async checkSSSDStatus(host: string): Promise<SSHCommandResult> {
    const command = 'sudo systemctl status sssd --no-pager';
    return this.executeCommand(host, command);
  }

  /**
   * Check SSSD status on multiple hosts
   */
  async checkSSSDStatusMultiple(hosts: string[]): Promise<Map<string, SSHCommandResult>> {
    const command = 'sudo systemctl status sssd --no-pager';
    return this.executeOnMultipleHosts(hosts, command);
  }

  /**
   * Get SSSD cache statistics from a host
   */
  async getSSSDCacheStats(host: string): Promise<SSHCommandResult> {
    const command = 'sudo sssctl cache-expire -h || sudo ls -lh /var/lib/sss/db/';
    return this.executeCommand(host, command);
  }

  /**
   * Invalidate user cache entry
   */
  async invalidateUser(host: string, username: string): Promise<SSHCommandResult> {
    validateShellSafe(username, 'username');
    const command = `sudo sss_cache -u ${username}`;
    return this.executeCommand(host, command);
  }

  /**
   * Invalidate group cache entry
   */
  async invalidateGroup(host: string, groupname: string): Promise<SSHCommandResult> {
    validateShellSafe(groupname, 'groupname');
    const command = `sudo sss_cache -g ${groupname}`;
    return this.executeCommand(host, command);
  }

  /**
   * Test connectivity to a host
   */
  async testConnectivity(host: string): Promise<boolean> {
    try {
      const result = await this.executeCommand(host, 'echo "test"');
      return result.exitCode === 0 && result.stdout.trim() === 'test';
    } catch {
      return false;
    }
  }

  /**
   * Test connectivity to multiple hosts
   */
  async testConnectivityMultiple(hosts: string[]): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    const promises = hosts.map(async (host) => {
      const isConnected = await this.testConnectivity(host);
      results.set(host, isConnected);
    });

    await Promise.all(promises);
    return results;
  }
}
