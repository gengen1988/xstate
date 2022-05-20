import { serializeState, SimpleBehavior } from '@xstate/graph';
import {
  ActionObject,
  AnyEventObject,
  AnyState,
  AnyStateMachine,
  createMachine,
  EventFrom,
  EventObject,
  StateFrom,
  TypegenConstraint,
  TypegenDisabled
} from 'xstate';
import { TestModel } from './TestModel';
import {
  TestMachineConfig,
  TestMachineOptions,
  TestModelEventConfig,
  TestModelOptions
} from './types';
import { flatten } from './utils';
import { validateMachine } from './validateMachine';

export async function testStateFromMeta(state: AnyState) {
  for (const id of Object.keys(state.meta)) {
    const stateNodeMeta = state.meta[id];
    if (typeof stateNodeMeta.test === 'function' && !stateNodeMeta.skip) {
      await stateNodeMeta.test(state);
    }
  }
}

export function createTestMachine<
  TContext,
  TEvent extends EventObject = AnyEventObject,
  TTypesMeta extends TypegenConstraint = TypegenDisabled
>(
  config: TestMachineConfig<TContext, TEvent, TTypesMeta>,
  options?: TestMachineOptions<TContext, TEvent, TTypesMeta>
) {
  return createMachine(config, options as any);
}

export function executeAction(
  actionObject: ActionObject<any, any>,
  state: AnyState
): void {
  if (typeof actionObject.exec === 'function') {
    actionObject.exec(state.context, state.event, {
      _event: state._event,
      action: actionObject,
      state
    });
  }
}

/**
 * Creates a test model that represents an abstract model of a
 * system under test (SUT).
 *
 * The test model is used to generate test plans, which are used to
 * verify that states in the `machine` are reachable in the SUT.
 *
 * @example
 *
 * ```js
 * const toggleModel = createModel(toggleMachine).withEvents({
 *   TOGGLE: {
 *     exec: async page => {
 *       await page.click('input');
 *     }
 *   }
 * });
 * ```
 *
 * @param machine The state machine used to represent the abstract model.
 * @param options Options for the created test model:
 * - `events`: an object mapping string event types (e.g., `SUBMIT`)
 * to an event test config (e.g., `{exec: () => {...}, cases: [...]}`)
 */
export function createTestModel<TMachine extends AnyStateMachine>(
  machine: TMachine,
  options?: Partial<TestModelOptions<StateFrom<TMachine>, EventFrom<TMachine>>>
): TestModel<StateFrom<TMachine>, EventFrom<TMachine>> {
  validateMachine(machine);

  const testModel = new TestModel<StateFrom<TMachine>, EventFrom<TMachine>>(
    machine as SimpleBehavior<any, any>,
    {
      serializeState,
      stateMatcher: (state, key) => {
        return key.startsWith('#')
          ? state.configuration.includes(machine.getStateNodeById(key))
          : state.matches(key);
      },
      states: {
        '*': testStateFromMeta
      },
      execute: (state) => {
        state.actions.forEach((action) => {
          executeAction(action, state);
        });
      },
      getEvents: (state) =>
        flatten(
          state.nextEvents.map((eventType) => {
            const eventConfig = options?.events?.[eventType];
            const eventCaseGenerator =
              typeof eventConfig === 'function'
                ? undefined
                : (eventConfig?.cases as TestModelEventConfig<
                    any,
                    any
                  >['cases']);

            const cases = eventCaseGenerator
              ? Array.isArray(eventCaseGenerator)
                ? eventCaseGenerator
                : eventCaseGenerator(state)
              : [{ type: eventType }];

            return (
              // Use generated events or a plain event without payload
              cases.map((e) => {
                return { type: eventType, ...(e as any) };
              })
            );
          })
        ),
      ...options
    }
  );

  return testModel;
}