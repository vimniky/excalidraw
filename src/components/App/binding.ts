import {
  getEligibleElementsForBinding,
  getHoveredElementForBinding,
  isLinearElementSimpleAndAlreadyBound,
  shouldEnableBindingForPointerEvent,
} from "../../element/binding";
import {
  NonDeleted,
  ExcalidrawLinearElement,
  ExcalidrawBindableElement,
  ExcalidrawElement,
} from "../../element/types";
import App from "../App";

export const maybeSuggestBindingForLinearElementAtCursor = ($app: App) => (
  linearElement: NonDeleted<ExcalidrawLinearElement>,
  startOrEnd: "start" | "end",
  pointerCoords: {
    x: number;
    y: number;
  },
  // During line creation the start binding hasn't been written yet
  // into `linearElement`
  oppositeBindingBoundElement?: ExcalidrawBindableElement | null,
): void => {
  const hoveredBindableElement = getHoveredElementForBinding(
    pointerCoords,
    App.scene,
  );
  $app.setState({
    suggestedBindings:
      hoveredBindableElement != null &&
      !isLinearElementSimpleAndAlreadyBound(
        linearElement,
        oppositeBindingBoundElement?.id,
        hoveredBindableElement,
      )
        ? [hoveredBindableElement]
        : [],
  });
};

export const updateBindingEnabledOnPointerMove = ($app: App) => (
  event: React.PointerEvent<HTMLCanvasElement>,
) => {
  const shouldEnableBinding = shouldEnableBindingForPointerEvent(event);
  if ($app.state.isBindingEnabled !== shouldEnableBinding) {
    $app.setState({ isBindingEnabled: shouldEnableBinding });
  }
};

export const maybeSuggestBindingAtCursor = ($app: App) => (pointerCoords: {
  x: number;
  y: number;
}): void => {
  const hoveredBindableElement = getHoveredElementForBinding(
    pointerCoords,
    App.scene,
  );
  $app.setState({
    suggestedBindings:
      hoveredBindableElement != null ? [hoveredBindableElement] : [],
  });
};

export const maybeSuggestBindingForAll = ($app: App) => (
  selectedElements: NonDeleted<ExcalidrawElement>[],
): void => {
  const suggestedBindings = getEligibleElementsForBinding(selectedElements);
  $app.setState({ suggestedBindings });
};
