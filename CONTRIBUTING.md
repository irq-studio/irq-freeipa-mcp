# Contributing to FreeIPA MCP Server

Thank you for considering contributing to the FreeIPA MCP Server! This document provides guidelines for contributing to the project.

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). By participating, you are expected to uphold this code.

## How to Contribute

### Reporting Bugs

Before creating a bug report, please check existing issues to avoid duplicates. When creating a bug report, include:

- **Clear title and description**
- **Steps to reproduce** the issue
- **Expected behavior** vs actual behavior
- **Environment details** (Node.js version, FreeIPA version, OS)
- **Error messages** or logs (sanitize any sensitive data)

### Suggesting Features

Feature requests are welcome! Please provide:

- **Use case**: Describe the problem you're trying to solve
- **Proposed solution**: How you envision the feature working
- **Alternatives considered**: Other approaches you've thought about
- **Impact**: Who would benefit from this feature

### Pull Requests

1. **Fork the repository** and create a new branch from `main`
2. **Follow the coding style** (see below)
3. **Write tests** if adding new functionality
4. **Update documentation** (README, JSDoc comments)
5. **Ensure all tests pass** (`npm test`)
6. **Commit with clear messages** following conventional commits

#### Pull Request Checklist

- [ ] Code compiles without TypeScript errors (`npm run build`)
- [ ] All existing tests pass
- [ ] New tests added for new functionality
- [ ] Documentation updated (README.md, code comments)
- [ ] No credentials or sensitive data in code
- [ ] .gitignore properly excludes generated files
- [ ] Commit messages follow conventional commits format

## Development Setup

### Prerequisites

- Node.js 18+ and npm
- Access to a FreeIPA server for testing
- SSH access to test hosts (for SSSD cache tools)

### Setup Steps

```bash
# Clone your fork
git clone https://github.com/YOUR-USERNAME/irq-freeipa-mcp.git
cd irq-freeipa-mcp

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your test credentials
# IMPORTANT: Use a test FreeIPA instance, not production!

# Build the project
npm run build

# Run in development mode
npm run dev
```

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Coding Standards

### TypeScript Style

- Use **TypeScript strict mode** (already configured)
- Add **type annotations** for all function parameters and return types
- Use **interfaces** over type aliases for object shapes
- Prefer **async/await** over promise chains
- Use **const** by default, **let** when mutation is needed, avoid **var**

### Code Organization

```typescript
// Good: Clear, descriptive function with types
async function clearSSSDCache(
  host: string,
  force: boolean = false
): Promise<SSHCommandResult> {
  // Implementation
}

// Bad: Unclear, untyped
async function clear(h: any, f?: any): Promise<any> {
  // Implementation
}
```

### Error Handling

Always use custom error classes and provide meaningful error messages:

```typescript
// Good
if (!authenticated) {
  throw new FreeIPAError('Not authenticated. Call authenticate() first.');
}

// Bad
if (!authenticated) {
  throw new Error('auth failed');
}
```

### Documentation

- Add **JSDoc comments** for all public methods
- Include **parameter descriptions** and **return types**
- Provide **usage examples** for complex functions
- Update **README.md** when adding new tools

Example:

```typescript
/**
 * Clear SSSD cache on a remote host
 *
 * @param host - Hostname or IP address of the target system
 * @param force - Force immediate cache expiration using sss_cache -E
 * @returns SSH command result with stdout, stderr, and exit code
 *
 * @example
 * ```typescript
 * const result = await ssh.clearSSSDCache('host1.example.com', true);
 * console.log(result.exitCode === 0 ? 'Success' : 'Failed');
 * ```
 */
async clearSSSDCache(host: string, force: boolean = false): Promise<SSHCommandResult>
```

## Commit Message Format

Use [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks (dependencies, build, etc.)

### Examples

```
feat(sudo): add support for sudo command wildcards

Allow wildcard patterns in sudo commands for more flexible rules.
Previously only exact command paths were supported.

Closes #123
```

```
fix(auth): handle expired FreeIPA sessions gracefully

Re-authenticate automatically when session expires instead of
throwing an error. Improves reliability for long-running operations.
```

## Tool Development Guidelines

When adding new MCP tools:

### Tool Definition Structure

```typescript
{
  name: 'freeipa_tool_name',
  description: 'Clear, concise description of what the tool does',
  inputSchema: {
    type: 'object',
    properties: {
      param1: {
        type: 'string',
        description: 'Clear description of parameter purpose'
      },
      param2: {
        type: 'array',
        items: { type: 'string' },
        description: 'Description with example values'
      }
    },
    required: ['param1']
  }
}
```

### Tool Implementation

```typescript
case 'freeipa_tool_name': {
  // 1. Validate parameters
  if (!params.param1) {
    throw new Error('param1 is required');
  }

  // 2. Perform operation
  const result = await freeipa.apiCall(params.param1);

  // 3. Format response
  return {
    success: true,
    data: result,
    message: 'Operation completed successfully'
  };
}
```

### Documentation Requirements

When adding a new tool:

1. Add tool definition to `src/index.ts`
2. Add implementation in the switch statement
3. Add documentation to `README.md`:
   - Tool description
   - Parameters with types
   - Example usage
   - Common use cases
4. Update CHANGELOG.md
5. Add tests if applicable

## Security Guidelines

### Never Commit Credentials

- Always use `.env` files for credentials (gitignored)
- Use `.env.example` as a template
- Sanitize logs and error messages
- Review diffs before committing

### SSH and Authentication

- Use paramiko or ssh2 libraries, not shell commands
- Validate hostnames before SSH connections
- Timeout long-running SSH operations
- Close connections properly

### FreeIPA API

- Always use HTTPS (never HTTP)
- Validate API responses
- Handle session expiration gracefully
- Rate limit API calls if needed

## Testing

### Unit Tests

Test individual functions in isolation:

```typescript
describe('FreeIPAClient', () => {
  it('should authenticate successfully with valid credentials', async () => {
    const client = new FreeIPAClient();
    const result = await client.authenticate();
    expect(result).toBe(true);
  });
});
```

### Integration Tests

Test real FreeIPA operations (use test instance):

```typescript
describe('Sudo Rule Operations', () => {
  it('should create and enable a sudo rule', async () => {
    await freeipa.sudoruleAdd('test-rule', 'Test description');
    await freeipa.sudoruleEnable('test-rule');
    const rule = await freeipa.sudoruleShow('test-rule');
    expect(rule.ipaenabledflag).toBe(true);
  });
});
```

### Test Environment

- Use a **dedicated test FreeIPA instance**
- Never run tests against production
- Clean up test data after each test
- Mock external dependencies when appropriate

## Release Process

1. Update version in `package.json`
2. Update `CHANGELOG.md` with changes
3. Create git tag: `git tag -a v1.0.0 -m "Release v1.0.0"`
4. Push tags: `git push origin --tags`
5. Create GitHub release with changelog

## Questions?

- **Issues**: Open a GitHub issue for bugs or features
- **Discussions**: Use GitHub Discussions for questions
- **Security**: Email security concerns privately (see SECURITY.md)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
