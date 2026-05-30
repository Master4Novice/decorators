import {
  Controller,
  RestController,
  Get,
  Post,
  Delete,
  GetMapping,
  Param,
  Query,
  Body,
  Header,
  Req,
  Res,
  PathVariable,
  RequestParam,
  RequestBody,
  HttpCode,
  ContentType,
  Redirect,
  Use,
  registerControllers,
  type HttpApp,
  type RequestHandler,
} from '../src/services/rest.js';

interface Recorded {
  method: string;
  path: string;
  handlers: RequestHandler[];
}

function makeApp() {
  const recorded: Recorded[] = [];
  const app = {} as HttpApp;
  for (const m of ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'all']) {
    app[m] = (path: string, ...handlers: RequestHandler[]) => {
      recorded.push({ method: m, path, handlers });
    };
  }
  const find = (method: string, path: string) =>
    recorded.find((r) => r.method === method && r.path === path);
  return { app, recorded, find };
}

function makeRes() {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined as unknown,
    ended: false,
    redirectedTo: undefined as string | undefined,
    headersSent: false,
  };
  res.status = (c: number) => {
    res.statusCode = c;
    return res;
  };
  res.set = (k: string, v: string) => {
    res.headers[k] = v;
    return res;
  };
  res.json = (b: unknown) => {
    res.body = b;
    res.ended = true;
    return res;
  };
  res.send = (b: unknown) => {
    res.body = b;
    res.ended = true;
    return res;
  };
  res.end = () => {
    res.ended = true;
    return res;
  };
  res.redirect = (status: number, url: string) => {
    res.statusCode = status;
    res.redirectedTo = url;
    res.ended = true;
    return res;
  };
  return res;
}

const run = async (rec: Recorded, req: any, res: any) => {
  const next = (err?: unknown) => {
    if (err) throw err;
  };
  // Run middleware (if any) then the final handler.
  for (const h of rec.handlers) await h(req, res as any, next as any);
};

describe('routing & params', () => {
  it('wires GET with @Param/@Query and returns JSON 200', async () => {
    @Controller('/users')
    class UserController {
      @Get('/:id')
      getUser(@Param('id') id: string, @Query('verbose') verbose: string) {
        return { id, verbose };
      }
    }
    const { app, find } = makeApp();
    registerControllers(app, [new UserController()]);

    const rec = find('get', '/users/:id')!;
    expect(rec).toBeDefined();
    const res = makeRes();
    await run(rec, { params: { id: '7' }, query: { verbose: 'yes' }, headers: {} }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ id: '7', verbose: 'yes' });
  });

  it('wires POST with @Body and @HttpCode(201)', async () => {
    @Controller('/items')
    class ItemController {
      @Post('/')
      @HttpCode(201)
      create(@Body() body: { name: string }) {
        return { created: body.name };
      }
    }
    const { app, find } = makeApp();
    registerControllers(app, [new ItemController()]);
    const rec = find('post', '/items')!;
    const res = makeRes();
    await run(rec, { params: {}, query: {}, headers: {}, body: { name: 'x' } }, res);
    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({ created: 'x' });
  });

  it('supports the familiar route aliases', async () => {
    @RestController('/api')
    class ApiController {
      @GetMapping('/thing/:key')
      thing(
        @PathVariable('key') key: string,
        @RequestParam('q') q: string,
        @RequestBody() _body: unknown,
      ) {
        return { key, q };
      }
    }
    const { app, find } = makeApp();
    registerControllers(app, [new ApiController()]);
    const rec = find('get', '/api/thing/:key')!;
    const res = makeRes();
    await run(rec, { params: { key: 'k' }, query: { q: 'z' }, headers: {}, body: null }, res);
    expect(res.body).toEqual({ key: 'k', q: 'z' });
  });

  it('injects @Header', async () => {
    @Controller()
    class C {
      @Get('/h')
      h(@Header('x-token') token: string) {
        return { token };
      }
    }
    const { app, find } = makeApp();
    registerControllers(app, [new C()]);
    const res = makeRes();
    await run(find('get', '/h')!, { params: {}, query: {}, headers: { 'x-token': 'abc' } }, res);
    expect(res.body).toEqual({ token: 'abc' });
  });
});

describe('response control', () => {
  it('lets the handler own the response via @Res (no auto-send)', async () => {
    @Controller()
    class C {
      @Get('/raw')
      raw(@Res() res: any) {
        res.status(418).send('teapot');
      }
    }
    const { app, find } = makeApp();
    registerControllers(app, [new C()]);
    const res = makeRes();
    await run(find('get', '/raw')!, { params: {}, query: {}, headers: {} }, res);
    expect(res.statusCode).toBe(418);
    expect(res.body).toBe('teapot');
  });

  it('@Redirect redirects', async () => {
    @Controller()
    class C {
      @Get('/old')
      @Redirect('/new', 301)
      old() {}
    }
    const { app, find } = makeApp();
    registerControllers(app, [new C()]);
    const res = makeRes();
    await run(find('get', '/old')!, { params: {}, query: {}, headers: {} }, res);
    expect(res.statusCode).toBe(301);
    expect(res.redirectedTo).toBe('/new');
  });

  it('@ContentType sets the header', async () => {
    @Controller()
    class C {
      @Get('/xml')
      @ContentType('application/xml')
      xml() {
        return '<ok/>';
      }
    }
    const { app, find } = makeApp();
    registerControllers(app, [new C()]);
    const res = makeRes();
    await run(find('get', '/xml')!, { params: {}, query: {}, headers: {} }, res);
    expect(res.headers['Content-Type']).toBe('application/xml');
    expect(res.body).toBe('<ok/>');
  });
});

describe('middleware & errors', () => {
  it('attaches class- and method-level @Use middleware', () => {
    const mwA: RequestHandler = (_q, _s, n) => n();
    const mwB: RequestHandler = (_q, _s, n) => n();

    @Use(mwA)
    @Controller('/m')
    class C {
      @Use(mwB)
      @Get('/x')
      x() {
        return 'ok';
      }
    }
    const { app, find } = makeApp();
    registerControllers(app, [new C()]);
    const rec = find('get', '/m/x')!;
    // [classMw, methodMw, handler]
    expect(rec.handlers).toHaveLength(3);
    expect(rec.handlers[0]).toBe(mwA);
    expect(rec.handlers[1]).toBe(mwB);
  });

  it('routes errors to next(err)', async () => {
    @Controller()
    class C {
      @Delete('/boom')
      boom() {
        throw new Error('kaboom');
      }
    }
    const { app, find } = makeApp();
    registerControllers(app, [new C()]);
    const rec = find('delete', '/boom')!;
    const res = makeRes();
    let captured: unknown;
    await rec.handlers[0](
      { params: {}, query: {}, headers: {} } as any,
      res,
      (err?: unknown) => {
        captured = err;
      },
    );
    expect((captured as Error).message).toBe('kaboom');
  });
});

describe('registerControllers accepts a class', () => {
  it('instantiates a zero-arg controller class', async () => {
    @Controller('/z')
    class C {
      @Get('/')
      home() {
        return { ok: true };
      }
    }
    const { app, find } = makeApp();
    registerControllers(app, [C]);
    const res = makeRes();
    await run(find('get', '/z')!, { params: {}, query: {}, headers: {} }, res);
    expect(res.body).toEqual({ ok: true });
  });
});
