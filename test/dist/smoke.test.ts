// Pre-publish gate: exercise the BUILT artifact (dist/), not src. This is the
// only test that proves `import ... from '@master4n/decorators'` works with
// config/winston/uuid externalized — the failure class that bit us when the
// standalone build was first set up. Run after `npm run build`.
//
// @ts-nocheck — importing the emitted bundle, which has no source types here.
import * as dec from '../../dist/commonjs/index.cjs';
import * as decConfig from '../../dist/commonjs/config.cjs';
import * as decWinston from '../../dist/commonjs/winston.cjs';

describe('built dist bundle', () => {
  it('exports the full public API', () => {
    for (const name of [
      'Env',
      'Secret',
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
      'NotBlank',
      'Size',
      'Negative',
      'PositiveOrZero',
      'NegativeOrZero',
      'Past',
      'Future',
      'PastOrPresent',
      'FutureOrPresent',
      'AssertTrue',
      'AssertFalse',
      'Digits',
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
      'Validate',
      'Guardrail',
      'Idempotent',
      'Meter',
      'getMetrics',
      'GuardrailError',
      'Bind',
      'Lazy',
      'Sealed',
      'Mixin',
      'OnChange',
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
      'DEFAULT_SENSITIVE_KEYS',
    ]) {
      expect(typeof dec[name]).not.toBe('undefined');
    }
  });

  it('exposes the optional subpaths, and the main barrel no longer carries their symbols', () => {
    // node-config-backed decorators live in /config
    expect(typeof decConfig.Value).toBe('function');
    expect(typeof decConfig.Config).toBe('function');
    // winston format lives in /winston
    expect(typeof decWinston.redactFormat).toBe('function');
    // ...and are NOT on the zero-dep main barrel anymore
    expect((dec as Record<string, unknown>).Value).toBeUndefined();
    expect((dec as Record<string, unknown>).redactFormat).toBeUndefined();
  });

  it('shares the injection singleton across entry chunks (code-splitting works)', () => {
    // @Secret is registered on the barrel; the /winston redactFormat must see it
    // via the SHARED injection chunk — proof the registry was not duplicated.
    const { Secret, Configured } = dec;

    // `licenseCode` is NOT in DEFAULT_SENSITIVE_KEYS nor a sensitive stem — it is
    // ONLY redacted because @Secret registered it in the shared injection set.
    @Configured
    class Auth {
      @Secret('SMOKE_LICENSE', 'shh') licenseCode!: string;
    }
    new Auth();

    const fmt = decWinston.redactFormat();
    const info: Record<string, unknown> = {
      level: 'info',
      message: 'x',
      licenseCode: 'leaked',
    };
    const out = fmt.transform(info) as Record<string, unknown>;
    expect(out.licenseCode).toBe('[REDACTED]');
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
