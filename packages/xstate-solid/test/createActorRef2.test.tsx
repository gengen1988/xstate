/* @jsxImportSource solid-js */
import { useSnapshot, createActorRef } from '../src';
import { render, fireEvent, screen } from 'solid-testing-library';
import { fromTransition } from 'xstate/actors';

describe("usage with core's fromTransition", () => {
  it('should be able to spawn an actor from actor logic', () => {
    const reducer = (state: number, event: { type: 'INC' }): number => {
      if (event.type === 'INC') {
        return state + 1;
      }

      return state;
    };

    const Test = () => {
      const actorRef = createActorRef(fromTransition(reducer, 0));
      const count = useSnapshot(() => actorRef);

      return (
        <button
          data-testid="count"
          onclick={() => actorRef.send({ type: 'INC' })}
        >
          {count()}
        </button>
      );
    };

    render(() => <Test />);
    const button = screen.getByTestId('count');

    expect(button.textContent).toEqual('0');

    fireEvent.click(button);

    expect(button.textContent).toEqual('1');
  });
});
