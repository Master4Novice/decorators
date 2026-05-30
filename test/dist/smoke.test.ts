// Pre-publish gate: exercise the BUILT artifact (dist/), not src. This is the
// only test that proves `import ... from '@master4n/decorators'` works with
// config/winston/uuid externalized — the failure class that bit us when the
// standalone build was first set up. Run after `npm run build`.
//
// @ts-nocheck — importing the emitted bundle, which has no source types here.
import * as dec from '../../dist/commonjs/index.cjs';

describe('built dist bundle', () => {
  it('exports the full public API', () => {
    for (const name of [
      'Value',
      'Env',
      'Secret',
      'Config',
      'Default',
      'Configured',
      'MissingConfigError',
      'getSecretKeys',
      'loadEnv',
      'parseEnv',
      'GenerateID',
      'NotNull',
      'ValidDate',
      'Counter',
      'Log',
      'ValidationError',
      'ForbiddenError',
      'Pattern',
      'Min',
      'Max',
      'Range',
      'Trim',
      'Lowercase',
      'Uppercase',
      'Coerce',
      'Clamp',
      'Email',
      'URL',
      'UUID',
      'Enum',
      'NonEmpty',
      'Integer',
      'Positive',
      'Role',
      'Authorize',
      'setRoleResolver',
      'Retry',
      'Memoize',
      'Deprecated',
      'Measure',
      'Timeout',
      'Once',
      'Cache',
      'Dedupe',
      'Fallback',
      'RateLimit',
      'Concurrency',
      'CircuitBreaker',
      'Debounce',
      'Throttle',
      'TimeoutError',
      'RateLimitError',
      'CircuitOpenError',
      'Trace',
      'Audit',
      'LogErrors',
      'getTraceId',
      'setAuditResolver',
      'Tool',
      'getTools',
      'invokeTool',
      'clearTools',
      'ToString',
      'Equals',
      'With',
      'Data',
      'Immutable',
      'Readonly',
      'Synchronized',
      'Builder',
      'builder',
      'Controller',
      'RestController',
      'Get',
      'Post',
      'Put',
      'Patch',
      'Delete',
      'GetMapping',
      'RequestMapping',
      'Param',
      'Query',
      'Body',
      'Header',
      'Req',
      'Res',
      'PathVariable',
      'RequestParam',
      'RequestBody',
      'HttpCode',
      'ResponseStatus',
      'ContentType',
      'Redirect',
      'Use',
      'registerControllers',
      'loadEnv',
      'parseEnv',
      'redact',
      'redactFormat',
      'DEFAULT_SENSITIVE_KEYS',
    ]) {
      expect(typeof dec[name]).not.toBe('undefined');
    }
  });

  it('injects @Env/@Default through @Configured from the built bundle', () => {
    const { Configured, Env, Default } = dec;
    process.env.SMOKE_PORT = '7777';

    @Configured
    class Cfg {
      @Env('SMOKE_PORT', 3000) port!: number;
      @Default('ok') status!: string;
    }

    const cfg = new Cfg();
    expect(cfg.port).toBe(7777);
    expect(cfg.status).toBe('ok');
    delete process.env.SMOKE_PORT;
  });
});
