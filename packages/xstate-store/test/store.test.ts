import { createStore } from '../src/index.ts';

it('creates a store API', () => {
  const store = createStore({});

  expect(store).toMatchInlineSnapshot(`
    {
      "@@observable": [Function],
      "getInitialSnapshot": [Function],
      "getSnapshot": [Function],
      "select": [Function],
      "send": [Function],
      "subscribe": [Function],
    }
  `);
});

it('updates a store with an event without mutating original context', () => {
  const context = { count: 0 };
  const store = createStore(context, {
    inc: (c, ev: { type: 'inc'; by: number }) => {
      c.count += ev.by;
    }
  });

  const initial = store.getInitialSnapshot();

  store.send({ type: 'inc', by: 1 });

  const next = store.getSnapshot();

  expect(initial).toEqual({ count: 0 });
  expect(next).toEqual({ count: 1 });
  expect(context.count).toEqual(0);
});

it('updates state from sent events', () => {
  const store = createStore(
    {
      count: 0
    },
    {
      inc: (ctx, ev: { by: number }) => {
        ctx.count += ev.by;
      },
      dec: (ctx, ev: { by: number }) => {
        ctx.count -= ev.by;
      }
    }
  );

  store.send({ type: 'inc', by: 9 });
  store.send({ type: 'dec', by: 3 });

  expect(store.getSnapshot()).toEqual({ count: 6 });
});

it('selects values from context', () => {
  const store = createStore({
    users: [
      {
        name: 'David',
        pets: [
          {
            type: 'dog',
            name: 'Maki'
          },
          {
            type: 'dog',
            name: 'Ato'
          }
        ]
      }
    ]
  });

  const firstPet = store.select((s) => s.users[0]?.pets[0]?.name);

  expect(firstPet).toBe('Maki');
});
