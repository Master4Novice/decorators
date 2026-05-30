import {
  Tool,
  getTools,
  invokeTool,
  clearTools,
} from '../src/services/ai.js';

beforeEach(() => clearTools());

describe('@Tool', () => {
  it('registers a manifest and leaves the method callable', () => {
    class Weather {
      @Tool({
        description: 'Get the temperature for a city',
        parameters: {
          type: 'object',
          properties: { city: { type: 'string' } },
          required: ['city'],
        },
      })
      getTemperature(args: { city: string }) {
        return `temp for ${args.city}`;
      }
    }

    const manifest = getTools();
    expect(manifest).toHaveLength(1);
    expect(manifest[0]).toEqual({
      name: 'getTemperature',
      description: 'Get the temperature for a city',
      parameters: {
        type: 'object',
        properties: { city: { type: 'string' } },
        required: ['city'],
      },
    });
    // Method still works normally.
    expect(new Weather().getTemperature({ city: 'Pune' })).toBe('temp for Pune');
  });

  it('uses an explicit name when provided', () => {
    class S {
      @Tool({ name: 'search_web', description: 'Search the web' })
      search() {
        return 'results';
      }
    }
    void S;
    expect(getTools().map((t) => t.name)).toEqual(['search_web']);
    // Defaults parameters to an empty object schema.
    expect(getTools()[0].parameters).toEqual({ type: 'object', properties: {} });
  });

  it('dispatches a tool call to the method via invokeTool', () => {
    class Calc {
      @Tool({ description: 'Add two numbers' })
      add(args: { a: number; b: number }) {
        return args.a + args.b;
      }
    }
    const calc = new Calc();
    expect(invokeTool(calc, 'add', { a: 2, b: 3 })).toBe(5);
  });

  it('throws for an unknown tool', () => {
    expect(() => invokeTool({}, 'nope')).toThrow(/unknown tool/);
  });
});
