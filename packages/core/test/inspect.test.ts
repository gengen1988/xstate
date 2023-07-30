import {
  InspectionEvent,
  createMachine,
  fromPromise,
  interpret,
  sendParent,
  sendTo,
  waitFor
} from '../src';
const WebSocket = require('ws');

const server = new WebSocket.Server({ port: 8080 });

function simplifyEvent(inspectionEvent: InspectionEvent) {
  if (inspectionEvent.type === '@xstate.communication') {
    return {
      type: inspectionEvent.type,
      sourceId: inspectionEvent.sourceId,
      targetId: inspectionEvent.targetId,
      event: inspectionEvent.event.type
    };
  }
  if (inspectionEvent.type === '@xstate.registration') {
    return {
      type: inspectionEvent.type,
      sessionId: inspectionEvent.sessionId
    };
  }
  return {
    type: inspectionEvent.type,
    sessionId: inspectionEvent.sessionId,
    snapshot:
      typeof inspectionEvent.snapshot === 'object' &&
      'value' in inspectionEvent.snapshot
        ? { value: inspectionEvent.snapshot.value }
        : inspectionEvent.snapshot,
    event: inspectionEvent.event.type
  };
}

describe('inspect', () => {
  it('the .inspect option can observe inspection events', async () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            NEXT: 'b'
          }
        },
        b: {
          on: {
            NEXT: 'c'
          }
        },
        c: {}
      }
    });

    const events: InspectionEvent[] = [];

    const actor = interpret(machine, {
      inspect: {
        next(event) {
          events.push(event);
          // push events to websocket server
          server.clients.forEach((client) => {
            client.send(JSON.stringify(event));
          });
        }
      }
    });
    actor.start();

    actor.send({ type: 'NEXT' });
    actor.send({ type: 'NEXT' });

    expect(events.map(simplifyEvent)).toMatchInlineSnapshot(`
      [
        {
          "sessionId": "x:0",
          "type": "@xstate.registration",
        },
        {
          "event": "xstate.init",
          "sessionId": "x:0",
          "snapshot": {
            "value": "a",
          },
          "type": "@xstate.transition",
        },
        {
          "event": "NEXT",
          "sourceId": undefined,
          "targetId": "x:0",
          "type": "@xstate.communication",
        },
        {
          "event": "NEXT",
          "sessionId": "x:0",
          "snapshot": {
            "value": "b",
          },
          "type": "@xstate.transition",
        },
        {
          "event": "NEXT",
          "sourceId": undefined,
          "targetId": "x:0",
          "type": "@xstate.communication",
        },
        {
          "event": "NEXT",
          "sessionId": "x:0",
          "snapshot": {
            "value": "c",
          },
          "type": "@xstate.transition",
        },
      ]
    `);
  });

  it('can inspect communications between actors', async () => {
    const parentMachine = createMachine({
      initial: 'waiting',
      states: {
        waiting: {},
        success: {}
      },
      invoke: {
        src: createMachine({
          initial: 'start',
          states: {
            start: {
              on: {
                loadChild: 'loading'
              }
            },
            loading: {
              invoke: {
                src: fromPromise(() => {
                  return Promise.resolve(42);
                }),
                onDone: {
                  target: 'loaded',
                  actions: sendParent({ type: 'toParent' })
                }
              }
            },
            loaded: {
              type: 'final'
            }
          }
        }),
        id: 'child',
        onDone: {
          target: '.success',
          actions: () => {
            events;
          }
        }
      },
      on: {
        load: {
          actions: sendTo('child', { type: 'loadChild' })
        }
      }
    });

    const events: InspectionEvent[] = [];

    const actor = interpret(parentMachine, {
      inspect: {
        next: (event) => {
          events.push(event);

          // push events to websocket server
          server.clients.forEach((client) => {
            client.send(JSON.stringify(event));
          });
        }
      }
    });

    // wait 10 seconds
    await new Promise((resolve) => setTimeout(resolve, 10000));

    actor.start();
    actor.send({ type: 'load' });

    await waitFor(actor, (state) => state.value === 'success');

    expect(events.map(simplifyEvent)).toMatchInlineSnapshot(`
      [
        {
          "sessionId": "x:0",
          "type": "@xstate.registration",
        },
        {
          "sessionId": "x:1",
          "type": "@xstate.registration",
        },
        {
          "event": "xstate.init",
          "sessionId": "x:1",
          "snapshot": {
            "value": "start",
          },
          "type": "@xstate.transition",
        },
        {
          "event": "xstate.init",
          "sessionId": "x:0",
          "snapshot": {
            "value": "waiting",
          },
          "type": "@xstate.transition",
        },
        {
          "event": "load",
          "sourceId": undefined,
          "targetId": "x:0",
          "type": "@xstate.communication",
        },
        {
          "event": "loadChild",
          "sourceId": "x:0",
          "targetId": "x:1",
          "type": "@xstate.communication",
        },
        {
          "sessionId": "x:2",
          "type": "@xstate.registration",
        },
        {
          "event": "xstate.init",
          "sessionId": "x:2",
          "snapshot": undefined,
          "type": "@xstate.transition",
        },
        {
          "event": "loadChild",
          "sessionId": "x:1",
          "snapshot": {
            "value": "loading",
          },
          "type": "@xstate.transition",
        },
        {
          "event": "load",
          "sessionId": "x:0",
          "snapshot": {
            "value": "waiting",
          },
          "type": "@xstate.transition",
        },
        {
          "event": "$$xstate.resolve",
          "sourceId": "x:2",
          "targetId": "x:2",
          "type": "@xstate.communication",
        },
        {
          "event": "done.invoke.(machine).loading:invocation[0]",
          "sourceId": "x:2",
          "targetId": "x:1",
          "type": "@xstate.communication",
        },
        {
          "event": "toParent",
          "sourceId": "x:1",
          "targetId": "x:0",
          "type": "@xstate.communication",
        },
        {
          "event": "toParent",
          "sessionId": "x:0",
          "snapshot": {
            "value": "waiting",
          },
          "type": "@xstate.transition",
        },
        {
          "event": "done.invoke.child",
          "sourceId": "x:1",
          "targetId": "x:0",
          "type": "@xstate.communication",
        },
        {
          "event": "done.invoke.child",
          "sessionId": "x:0",
          "snapshot": {
            "value": "success",
          },
          "type": "@xstate.transition",
        },
        {
          "event": "done.invoke.(machine).loading:invocation[0]",
          "sessionId": "x:1",
          "snapshot": {
            "value": "loaded",
          },
          "type": "@xstate.transition",
        },
        {
          "event": "$$xstate.resolve",
          "sessionId": "x:2",
          "snapshot": 42,
          "type": "@xstate.transition",
        },
      ]
    `);
  }, 20000);
});