/**
 * Decorator-based REST controllers for Express (and any Express-compatible
 * router). Decorate a class with `@Controller`, its methods with `@Get`/`@Post`/…,
 * and their parameters with `@Param`/`@Query`/`@Body`/… — then wire everything
 * into your app with {@link registerControllers}.
 *
 * Framework-agnostic: it depends only on the structural shape of Express's
 * `app`, `req`, and `res`, so there is no `express` runtime dependency.
 */

/** Minimal Express-compatible request shape. */
export interface HttpRequest {
  params: Record<string, string>;
  query: Record<string, unknown>;
  body: unknown;
  headers: Record<string, unknown>;
  cookies?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Minimal Express-compatible response shape. */
export interface HttpResponse {
  status(code: number): HttpResponse;
  set(field: string, value: string): HttpResponse;
  json(body: unknown): unknown;
  send(body: unknown): unknown;
  end(): unknown;
  redirect(status: number, url: string): unknown;
  headersSent?: boolean;
  [key: string]: unknown;
}

export type RequestHandler = (
  req: HttpRequest,
  res: HttpResponse,
  next: (error?: unknown) => void,
) => unknown;

/** Minimal Express-compatible app/router shape (`app.get(path, ...handlers)`). */
export type HttpApp = Record<
  string,
  (path: string, ...handlers: RequestHandler[]) => unknown
>;

type ParamKind =
  | 'param'
  | 'query'
  | 'body'
  | 'header'
  | 'cookie'
  | 'req'
  | 'res'
  | 'next';

interface ParamMeta {
  index: number;
  kind: ParamKind;
  name?: string;
}

interface RouteMeta {
  httpMethod?: string;
  path: string;
  handlerName: string;
  status?: number;
  contentType?: string;
  redirect?: { url: string; status: number };
  middleware: RequestHandler[];
}

interface ControllerMeta {
  basePath: string;
  middleware: RequestHandler[];
  routes: Map<string, RouteMeta>;
  params: Map<string, ParamMeta[]>;
}

const registry = new WeakMap<object, ControllerMeta>();

function getMeta(proto: object): ControllerMeta {
  let meta = registry.get(proto);
  if (!meta) {
    meta = { basePath: '', middleware: [], routes: new Map(), params: new Map() };
    registry.set(proto, meta);
  }
  return meta;
}

function getRoute(meta: ControllerMeta, handlerName: string): RouteMeta {
  let route = meta.routes.get(handlerName);
  if (!route) {
    route = { path: '/', handlerName, middleware: [] };
    meta.routes.set(handlerName, route);
  }
  return route;
}

function joinPaths(base: string, path: string): string {
  const segments = `${base}/${path}`.split('/').filter(Boolean);
  return '/' + segments.join('/');
}

// --- Class decorator -------------------------------------------------------

/**
 * Marks a class as a REST controller with an optional base path. Alias:
 * `@RestController`.
 *
 * @example
 * \@Controller('/users')
 * class UserController { ... }
 */
export function Controller(basePath = '') {
  return function (ctor: new (...args: any[]) => object): void {
    getMeta(ctor.prototype).basePath = basePath;
  };
}

/** Alias for {@link Controller}. */
export const RestController = Controller;

// --- HTTP method decorators ------------------------------------------------

function methodDecorator(httpMethod: string) {
  return (path = '/') =>
    function (target: object, handlerName: string, descriptor: PropertyDescriptor) {
      const route = getRoute(getMeta(target), handlerName);
      route.httpMethod = httpMethod;
      route.path = path;
      return descriptor;
    };
}

/** Route an HTTP GET. Alias: `@GetMapping`. */
export const Get = methodDecorator('get');
/** Route an HTTP POST. Alias: `@PostMapping`. */
export const Post = methodDecorator('post');
/** Route an HTTP PUT. Alias: `@PutMapping`. */
export const Put = methodDecorator('put');
/** Route an HTTP PATCH. Alias: `@PatchMapping`. */
export const Patch = methodDecorator('patch');
/** Route an HTTP DELETE. Alias: `@DeleteMapping`. */
export const Delete = methodDecorator('delete');
/** Route an HTTP OPTIONS. */
export const Options = methodDecorator('options');
/** Route an HTTP HEAD. */
export const Head = methodDecorator('head');
/** Route all HTTP methods for the path. */
export const All = methodDecorator('all');

export const GetMapping = Get;
export const PostMapping = Post;
export const PutMapping = Put;
export const PatchMapping = Patch;
export const DeleteMapping = Delete;

/**
 * `@RequestMapping(path, method?)` — defaults to matching all
 * methods when `method` is omitted.
 */
export function RequestMapping(path = '/', method?: string) {
  return methodDecorator((method ?? 'all').toLowerCase())(path);
}

// --- Parameter decorators --------------------------------------------------

function paramDecorator(kind: ParamKind) {
  return (name?: string) =>
    function (target: object, handlerName: string, index: number) {
      const meta = getMeta(target);
      const list = meta.params.get(handlerName) ?? [];
      list.push({ index, kind, name });
      meta.params.set(handlerName, list);
    };
}

/** Inject a route path variable (`req.params[name]`, or all params). Alias: `@PathVariable`. */
export const Param = paramDecorator('param');
/** Inject a query-string value (`req.query[name]`, or all). Alias: `@RequestParam`. */
export const Query = paramDecorator('query');
/** Inject the request body (`req.body`, or `req.body[name]`). Alias: `@RequestBody`. */
export const Body = paramDecorator('body');
/** Inject a request header (`req.headers[name]`, or all). Alias: `@RequestHeader`. */
export const Header = paramDecorator('header');
/** Inject a cookie (`req.cookies[name]`, or all). */
export const Cookie = paramDecorator('cookie');
/** Inject the raw request object. */
export const Req = paramDecorator('req');
/** Inject the raw response object. When used, you manage the response yourself. */
export const Res = paramDecorator('res');
/** Inject Express's `next` function. */
export const Next = paramDecorator('next');

export const PathVariable = Param;
export const RequestParam = Query;
export const RequestBody = Body;
export const RequestHeader = Header;

// --- Method modifiers ------------------------------------------------------

/** Set the success HTTP status code for a route. Alias: `@ResponseStatus`. */
export function HttpCode(code: number) {
  return function (target: object, handlerName: string, descriptor: PropertyDescriptor) {
    getRoute(getMeta(target), handlerName).status = code;
    return descriptor;
  };
}
export const ResponseStatus = HttpCode;

/** Set the response `Content-Type`. Alias: `@Produces`. */
export function ContentType(type: string) {
  return function (target: object, handlerName: string, descriptor: PropertyDescriptor) {
    getRoute(getMeta(target), handlerName).contentType = type;
    return descriptor;
  };
}
export const Produces = ContentType;

/** Redirect to `url` (default 302) instead of returning a body. */
export function Redirect(url: string, status = 302) {
  return function (target: object, handlerName: string, descriptor: PropertyDescriptor) {
    getRoute(getMeta(target), handlerName).redirect = { url, status };
    return descriptor;
  };
}

/**
 * Attach Express middleware. As a **class** decorator it applies to every route;
 * as a **method** decorator it applies to that route only.
 *
 * @example
 * \@Use(authMiddleware)
 * \@Controller('/admin')
 * class AdminController {
 *   \@Use(rateLimitMiddleware)
 *   \@Get('/stats') stats() { ... }
 * }
 */
export function Use(...middleware: RequestHandler[]) {
  return function (
    target: any,
    handlerName?: string,
    _descriptor?: PropertyDescriptor,
  ): void {
    if (handlerName === undefined) {
      // Class decorator: target is the constructor.
      getMeta(target.prototype).middleware.push(...middleware);
    } else {
      // Method decorator: target is the prototype.
      getRoute(getMeta(target), handlerName).middleware.push(...middleware);
    }
  };
}

// --- Wiring ----------------------------------------------------------------

function extractArg(
  param: ParamMeta,
  req: HttpRequest,
  res: HttpResponse,
  next: (error?: unknown) => void,
): unknown {
  switch (param.kind) {
    case 'param':
      return param.name ? req.params?.[param.name] : req.params;
    case 'query':
      return param.name ? req.query?.[param.name] : req.query;
    case 'body':
      return param.name
        ? (req.body as Record<string, unknown>)?.[param.name]
        : req.body;
    case 'header':
      return param.name
        ? req.headers?.[param.name.toLowerCase()]
        : req.headers;
    case 'cookie':
      return param.name ? req.cookies?.[param.name] : req.cookies;
    case 'req':
      return req;
    case 'res':
      return res;
    case 'next':
      return next;
  }
}

function buildHandler(
  instance: Record<string, any>,
  route: RouteMeta,
  params: ParamMeta[],
): RequestHandler {
  const ownsResponse = params.some((p) => p.kind === 'res' || p.kind === 'next');
  const maxIndex = params.reduce((m, p) => Math.max(m, p.index), -1);

  return async (req, res, next) => {
    try {
      const args = new Array(maxIndex + 1);
      for (const p of params) args[p.index] = extractArg(p, req, res, next);

      const result = await instance[route.handlerName](...args);

      // If the handler took `res`/`next`, it manages the response itself.
      if (ownsResponse || res.headersSent) return;
      if (route.redirect) {
        return res.redirect(route.redirect.status, route.redirect.url);
      }
      if (route.contentType) res.set('Content-Type', route.contentType);
      res.status(route.status ?? 200);
      if (result === undefined || result === null) return res.end();
      return typeof result === 'object'
        ? res.json(result)
        : res.send(String(result));
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Wire decorated controllers into an Express-compatible `app` (or `Router`).
 * Accepts controller instances or zero-arg classes.
 *
 * @example
 * const app = express();
 * app.use(express.json());
 * registerControllers(app, [new UserController()]);
 */
export function registerControllers(
  app: HttpApp,
  controllers: Array<object | (new () => object)>,
): void {
  for (const entry of controllers) {
    const instance =
      typeof entry === 'function'
        ? new (entry as new () => object)()
        : entry;
    const proto =
      typeof entry === 'function'
        ? (entry as { prototype: object }).prototype
        : Object.getPrototypeOf(instance);

    const meta = registry.get(proto);
    if (!meta) continue;

    for (const route of meta.routes.values()) {
      if (!route.httpMethod) continue; // no @Get/@Post/... on this method
      const verb = app[route.httpMethod];
      if (typeof verb !== 'function') continue;

      const fullPath = joinPaths(meta.basePath, route.path);
      const params = (meta.params.get(route.handlerName) ?? []).slice();
      const handler = buildHandler(
        instance as Record<string, any>,
        route,
        params,
      );
      verb(fullPath, ...meta.middleware, ...route.middleware, handler);
    }
  }
}
