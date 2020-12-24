import { LINE_CONFIRM_THRESHOLD, CURSOR_TYPE } from "../../constants";
import {
  getElementWithTransformHandleType,
  getCursorForResizingElement,
  getTransformHandleTypeFromCoords,
  getCommonBounds,
  isTextElement,
} from "../../element";
import { LinearElementEditor } from "../../element/linearElementEditor";
import { mutateElement } from "../../element/mutateElement";
import {
  isBindingElementType,
  isBindingElement,
} from "../../element/typeChecks";
import { getCenter, getDistance } from "../../gesture";
import { distance2d, isPathALoop } from "../../math";
import {
  normalizeScroll,
  getNewZoom,
  getNormalizedZoom,
  isOverScrollBars,
  getSelectedElements,
} from "../../scene";
import {
  resetCursor,
  setCursorForShape,
  viewportCoordsToSceneCoords,
} from "../../utils";
import App from "../App";

export const handleCanvasPointerMove = ($app: App) => (
  event: React.PointerEvent<HTMLCanvasElement>,
) => {
  $app.savePointer(event.clientX, event.clientY, $app.state.cursorButton);

  if (App.gesture.pointers.has(event.pointerId)) {
    App.gesture.pointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
  }

  const initialScale = App.gesture.initialScale;
  if (
    App.gesture.pointers.size === 2 &&
    App.gesture.lastCenter &&
    initialScale &&
    App.gesture.initialDistance
  ) {
    const center = getCenter(App.gesture.pointers);
    const deltaX = center.x - App.gesture.lastCenter.x;
    const deltaY = center.y - App.gesture.lastCenter.y;
    App.gesture.lastCenter = center;

    const distance = getDistance(Array.from(App.gesture.pointers.values()));
    const scaleFactor = distance / App.gesture.initialDistance;

    $app.setState(({ zoom, scrollX, scrollY, offsetLeft, offsetTop }) => ({
      scrollX: normalizeScroll(scrollX + deltaX / zoom.value),
      scrollY: normalizeScroll(scrollY + deltaY / zoom.value),
      zoom: getNewZoom(
        getNormalizedZoom(initialScale * scaleFactor),
        zoom,
        { left: offsetLeft, top: offsetTop },
        center,
      ),
      shouldCacheIgnoreZoom: true,
    }));
    $app.resetShouldCacheIgnoreZoomDebounced();
  } else {
    App.gesture.lastCenter = App.gesture.initialDistance = App.gesture.initialScale = null;
  }

  if (App.isHoldingSpace || App.isPanning || App.isDraggingScrollBar) {
    return;
  }
  const isPointerOverScrollBars = isOverScrollBars(
    App.currentScrollBars,
    event.clientX,
    event.clientY,
  );
  const isOverScrollBar = isPointerOverScrollBars.isOverEither;
  if (!$app.state.draggingElement && !$app.state.multiElement) {
    if (isOverScrollBar) {
      resetCursor();
    } else {
      setCursorForShape($app.state.elementType);
    }
  }

  const scenePointer = viewportCoordsToSceneCoords(event, $app.state);
  const { x: scenePointerX, y: scenePointerY } = scenePointer;

  if (
    $app.state.editingLinearElement &&
    !$app.state.editingLinearElement.isDragging
  ) {
    const editingLinearElement = LinearElementEditor.handlePointerMove(
      event,
      scenePointerX,
      scenePointerY,
      $app.state.editingLinearElement,
      $app.state.gridSize,
    );
    if (editingLinearElement !== $app.state.editingLinearElement) {
      $app.setState({ editingLinearElement });
    }
    if (editingLinearElement.lastUncommittedPoint != null) {
      $app.maybeSuggestBindingAtCursor(scenePointer);
    } else {
      $app.setState({ suggestedBindings: [] });
    }
  }

  if (isBindingElementType($app.state.elementType)) {
    // Hovering with a selected tool or creating new linear element via click
    // and point
    const { draggingElement } = $app.state;
    if (isBindingElement(draggingElement)) {
      $app.maybeSuggestBindingForLinearElementAtCursor(
        draggingElement,
        "end",
        scenePointer,
        $app.state.startBoundElement,
      );
    } else {
      $app.maybeSuggestBindingAtCursor(scenePointer);
    }
  }

  if ($app.state.multiElement) {
    const { multiElement } = $app.state;
    const { x: rx, y: ry } = multiElement;

    const { points, lastCommittedPoint } = multiElement;
    const lastPoint = points[points.length - 1];

    setCursorForShape($app.state.elementType);

    if (lastPoint === lastCommittedPoint) {
      // if we haven't yet created a temp point and we're beyond commit-zone
      // threshold, add a point
      if (
        distance2d(
          scenePointerX - rx,
          scenePointerY - ry,
          lastPoint[0],
          lastPoint[1],
        ) >= LINE_CONFIRM_THRESHOLD
      ) {
        mutateElement(multiElement, {
          points: [...points, [scenePointerX - rx, scenePointerY - ry]],
        });
      } else {
        document.documentElement.style.cursor = CURSOR_TYPE.POINTER;
        // in this branch, we're inside the commit zone, and no uncommitted
        // point exists. Thus do nothing (don't add/remove points).
      }
    } else if (
      points.length > 2 &&
      lastCommittedPoint &&
      distance2d(
        scenePointerX - rx,
        scenePointerY - ry,
        lastCommittedPoint[0],
        lastCommittedPoint[1],
      ) < LINE_CONFIRM_THRESHOLD
    ) {
      document.documentElement.style.cursor = CURSOR_TYPE.POINTER;
      mutateElement(multiElement, {
        points: points.slice(0, -1),
      });
    } else {
      if (isPathALoop(points)) {
        document.documentElement.style.cursor = CURSOR_TYPE.POINTER;
      }
      // update last uncommitted point
      mutateElement(multiElement, {
        points: [
          ...points.slice(0, -1),
          [scenePointerX - rx, scenePointerY - ry],
        ],
      });
    }

    return;
  }

  const hasDeselectedButton = Boolean(event.buttons);
  if (
    hasDeselectedButton ||
    ($app.state.elementType !== "selection" &&
      $app.state.elementType !== "text")
  ) {
    return;
  }

  const elements = App.scene.getElements();

  const selectedElements = getSelectedElements(elements, $app.state);
  if (
    selectedElements.length === 1 &&
    !isOverScrollBar &&
    !$app.state.editingLinearElement
  ) {
    const elementWithTransformHandleType = getElementWithTransformHandleType(
      elements,
      $app.state,
      scenePointerX,
      scenePointerY,
      $app.state.zoom,
      event.pointerType,
    );
    if (
      elementWithTransformHandleType &&
      elementWithTransformHandleType.transformHandleType
    ) {
      document.documentElement.style.cursor = getCursorForResizingElement(
        elementWithTransformHandleType,
      );
      return;
    }
  } else if (selectedElements.length > 1 && !isOverScrollBar) {
    const transformHandleType = getTransformHandleTypeFromCoords(
      getCommonBounds(selectedElements),
      scenePointerX,
      scenePointerY,
      $app.state.zoom,
      event.pointerType,
    );
    if (transformHandleType) {
      document.documentElement.style.cursor = getCursorForResizingElement({
        transformHandleType,
      });
      return;
    }
  }

  const hitElement = $app.getElementAtPosition(scenePointer.x, scenePointer.y);
  if ($app.state.elementType === "text") {
    document.documentElement.style.cursor = isTextElement(hitElement)
      ? CURSOR_TYPE.TEXT
      : CURSOR_TYPE.CROSSHAIR;
  } else if (isOverScrollBar) {
    document.documentElement.style.cursor = CURSOR_TYPE.AUTO;
  } else if (
    hitElement ||
    $app.isHittingCommonBoundingBoxOfSelectedElements(
      scenePointer,
      selectedElements,
    )
  ) {
    document.documentElement.style.cursor = CURSOR_TYPE.MOVE;
  } else {
    document.documentElement.style.cursor = CURSOR_TYPE.AUTO;
  }
};
