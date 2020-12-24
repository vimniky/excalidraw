import { actionFinalize } from "../../actions";
import {
  isBindingEnabled,
  maybeBindLinearElement,
} from "../../element/binding";
import { LinearElementEditor } from "../../element/linearElementEditor";
import { isBindingElement } from "../../element/typeChecks";
import { renderScene } from "../../renderer";
import { SceneState } from "../../scene/types";
import { ExcalidrawProps, AppState } from "../../types";
import { tupleToCoors, sceneCoordsToViewportCoords } from "../../utils";
import App from "../App";

export const componentDidUpdate = ($app: App) => (
  prevProps: ExcalidrawProps,
  prevState: AppState,
) => {
  if (
    prevProps.width !== $app.props.width ||
    prevProps.height !== $app.props.height ||
    (typeof $app.props.offsetLeft === "number" &&
      prevProps.offsetLeft !== $app.props.offsetLeft) ||
    (typeof $app.props.offsetTop === "number" &&
      prevProps.offsetTop !== $app.props.offsetTop)
  ) {
    $app.setState({
      width: $app.props.width ?? window.innerWidth,
      height: $app.props.height ?? window.innerHeight,
      ...App.getCanvasOffsets($app.props),
    });
  }

  document
    .querySelector(".excalidraw")
    ?.classList.toggle("Appearance_dark", $app.state.appearance === "dark");

  if (
    $app.state.editingLinearElement &&
    !$app.state.selectedElementIds[$app.state.editingLinearElement.elementId]
  ) {
    // defer so that the commitToHistory flag isn't reset via current update
    setTimeout(() => {
      App.actionManager.executeAction(actionFinalize);
    });
  }
  const { multiElement } = prevState;
  if (
    prevState.elementType !== $app.state.elementType &&
    multiElement != null &&
    isBindingEnabled($app.state) &&
    isBindingElement(multiElement)
  ) {
    maybeBindLinearElement(
      multiElement,
      $app.state,
      App.scene,
      tupleToCoors(
        LinearElementEditor.getPointAtIndexGlobalCoordinates(multiElement, -1),
      ),
    );
  }

  const cursorButton: {
    [id: string]: string | undefined;
  } = {};
  const pointerViewportCoords: SceneState["remotePointerViewportCoords"] = {};
  const remoteSelectedElementIds: SceneState["remoteSelectedElementIds"] = {};
  const pointerUsernames: { [id: string]: string } = {};
  $app.state.collaborators.forEach((user, socketId) => {
    if (user.selectedElementIds) {
      for (const id of Object.keys(user.selectedElementIds)) {
        if (!(id in remoteSelectedElementIds)) {
          remoteSelectedElementIds[id] = [];
        }
        remoteSelectedElementIds[id].push(socketId);
      }
    }
    if (!user.pointer) {
      return;
    }
    if (user.username) {
      pointerUsernames[socketId] = user.username;
    }
    pointerViewportCoords[socketId] = sceneCoordsToViewportCoords(
      {
        sceneX: user.pointer.x,
        sceneY: user.pointer.y,
      },
      $app.state,
    );
    cursorButton[socketId] = user.button;
  });
  const elements = App.scene.getElements();
  const { atLeastOneVisibleElement, scrollBars } = renderScene(
    elements.filter((element) => {
      // don't render text element that's being currently edited (it's
      // rendered on remote only)
      return (
        !$app.state.editingElement ||
        $app.state.editingElement.type !== "text" ||
        element.id !== $app.state.editingElement.id
      );
    }),
    $app.state,
    $app.state.selectionElement,
    window.devicePixelRatio,
    App.rc!,
    App.canvas!,
    {
      scrollX: $app.state.scrollX,
      scrollY: $app.state.scrollY,
      viewBackgroundColor: $app.state.viewBackgroundColor,
      zoom: $app.state.zoom,
      remotePointerViewportCoords: pointerViewportCoords,
      remotePointerButton: cursorButton,
      remoteSelectedElementIds,
      remotePointerUsernames: pointerUsernames,
      shouldCacheIgnoreZoom: $app.state.shouldCacheIgnoreZoom,
    },
    {
      renderOptimizations: true,
    },
  );
  if (scrollBars) {
    App.currentScrollBars = scrollBars;
  }
  const scrolledOutside =
    // hide when editing text
    $app.state.editingElement?.type === "text"
      ? false
      : !atLeastOneVisibleElement && elements.length > 0;
  if ($app.state.scrolledOutside !== scrolledOutside) {
    $app.setState({ scrolledOutside });
  }

  App.history.record($app.state, App.scene.getElementsIncludingDeleted());

  $app.props.onChange?.(App.scene.getElementsIncludingDeleted(), $app.state);
};
