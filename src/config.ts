/**
 * Configuration Loader
 * Loads configuration from YAML file with environment variable overrides
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export interface Config {
  freeipa: {
    server: string;
    username: string;
    password: string;  // Only loaded from environment variables
    verifySSL: boolean;
    timeout: number;
  };
  ssh: {
    username: string;
    password: string;  // Only loaded from environment variables
    port: number;
    timeout: number;
  };
  sssd: {
    domain: string;
    testing: {
      entryCacheTimeout: number;
      sudoTimeout: number;
    };
    production: {
      entryCacheTimeout: number;
      sudoTimeout: number;
    };
  };
  debug: boolean;
}

/**
 * Default configuration values
 * Note: Passwords are NOT included in defaults - they MUST come from environment variables
 */
const defaultConfig: Config = {
  freeipa: {
    server: 'ipa.example.com',
    username: 'admin@EXAMPLE.COM',
    password: '',  // Must be set via FREEIPA_PASSWORD environment variable
    verifySSL: true,
    timeout: 30000
  },
  ssh: {
    username: 'automation',
    password: '',  // Must be set via SSH_PASSWORD environment variable
    port: 22,
    timeout: 20000
  },
  sssd: {
    domain: 'example.com',
    testing: {
      entryCacheTimeout: 60,
      sudoTimeout: 120
    },
    production: {
      entryCacheTimeout: 300,
      sudoTimeout: 600
    }
  },
  debug: false
};

/**
 * Load configuration from YAML file
 */
function loadYamlConfig(configPath: string): Partial<Config> {
  try {
    if (fs.existsSync(configPath)) {
      const fileContents = fs.readFileSync(configPath, 'utf8');
      const yamlConfig = yaml.load(fileContents) as Partial<Config>;
      console.error(`✓ Loaded configuration from ${configPath}`);
      return yamlConfig;
    }
  } catch (error: any) {
    console.error(`Warning: Failed to load config file ${configPath}: ${error.message}`);
  }
  return {};
}

/**
 * Merge configurations with priority: Environment Variables > YAML > Defaults
 * SECURITY: Passwords are ONLY loaded from environment variables, never from YAML
 */
function mergeConfig(yamlConfig: Partial<Config>): Config {
  const config: Config = JSON.parse(JSON.stringify(defaultConfig));

  // Merge YAML config (excluding passwords)
  if (yamlConfig.freeipa) {
    // Merge all fields except password
    const { password, ...freeipaConfig } = yamlConfig.freeipa as any;
    Object.assign(config.freeipa, freeipaConfig);

    // Warn if password was found in YAML (security issue)
    if (password !== undefined && password !== '') {
      console.error('WARNING: Password found in config.yaml - this is a security risk!');
      console.error('Passwords should only be set via environment variables.');
      console.error('The password in config.yaml will be ignored.');
    }
  }

  if (yamlConfig.ssh) {
    // Merge all fields except password
    const { password, ...sshConfig } = yamlConfig.ssh as any;
    Object.assign(config.ssh, sshConfig);

    // Warn if password was found in YAML (security issue)
    if (password !== undefined && password !== '') {
      console.error('WARNING: SSH password found in config.yaml - this is a security risk!');
      console.error('Passwords should only be set via environment variables.');
      console.error('The password in config.yaml will be ignored.');
    }
  }

  if (yamlConfig.sssd) {
    if (yamlConfig.sssd.domain) {
      config.sssd.domain = yamlConfig.sssd.domain;
    }
    if (yamlConfig.sssd.testing) {
      Object.assign(config.sssd.testing, yamlConfig.sssd.testing);
    }
    if (yamlConfig.sssd.production) {
      Object.assign(config.sssd.production, yamlConfig.sssd.production);
    }
  }
  if (yamlConfig.debug !== undefined) {
    config.debug = yamlConfig.debug;
  }

  // Load credentials ONLY from environment variables
  if (process.env.FREEIPA_PASSWORD) {
    config.freeipa.password = process.env.FREEIPA_PASSWORD;
  }
  if (process.env.SSH_PASSWORD) {
    config.ssh.password = process.env.SSH_PASSWORD;
  }

  // Override other settings with environment variables
  if (process.env.FREEIPA_SERVER) {
    config.freeipa.server = process.env.FREEIPA_SERVER;
  }
  if (process.env.FREEIPA_USERNAME) {
    config.freeipa.username = process.env.FREEIPA_USERNAME;
  }
  if (process.env.SSH_USERNAME) {
    config.ssh.username = process.env.SSH_USERNAME;
  }
  if (process.env.SSSD_DOMAIN) {
    config.sssd.domain = process.env.SSSD_DOMAIN;
  }
  if (process.env.DEBUG) {
    config.debug = process.env.DEBUG === 'true';
  }

  return config;
}

/**
 * Validate that required credentials are present
 */
function validateConfig(config: Config): void {
  const errors: string[] = [];

  // Check required credentials
  if (!config.freeipa.password) {
    errors.push('FREEIPA_PASSWORD environment variable is required');
  }
  if (!config.ssh.password) {
    errors.push('SSH_PASSWORD environment variable is required');
  }

  // Check other required fields
  if (!config.freeipa.server) {
    errors.push('FreeIPA server is not configured');
  }
  if (!config.freeipa.username) {
    errors.push('FreeIPA username is not configured');
  }
  if (!config.ssh.username) {
    errors.push('SSH username is not configured');
  }

  // Print warnings
  if (errors.length > 0) {
    console.error('\n❌ Configuration errors detected:');
    errors.forEach(error => console.error(`   - ${error}`));
    console.error('\nThe server may not function correctly without these credentials.');
    console.error('Please set the required environment variables in your .env file or shell.\n');
  }
}

/**
 * Load and return the application configuration
 * Tries to load from config.yaml in the current directory
 */
export function loadConfig(): Config {
  const configPath = path.join(process.cwd(), 'config.yaml');
  const yamlConfig = loadYamlConfig(configPath);
  const config = mergeConfig(yamlConfig);

  // Validate configuration
  validateConfig(config);

  return config;
}

/**
 * Global configuration instance
 */
export const config = loadConfig();
