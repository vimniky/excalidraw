import React from "react";

import rough from "roughjs/bin/rough";
import { RoughCanvas } from "roughjs/bin/canvas";

import { isTextElement } from "../element";
import { isOverScrollBars } from "../scene";
import { AppState, Gesture, ExcalidrawProps } from "../types";
import { ExcalidrawElement, NonDeleted } from "../element/types";
import {
  debounce,
  ResolvablePromise,
  resolvablePromise,
  withBatchedUpdates,
} from "../utils";
import { createHistory, SceneHistory } from "../history";
import { ActionManager } from "../actions/manager";
import "../actions";
import { actions } from "../actions/register";
import { getDefaultAppState } from "../appState";
import { t, getLanguage } from "../i18n";
import { createUndoAction, createRedoAction } from "../actions/actionHistory";
import { EVENT, ENV, APP_NAME } from "../constants";

import LayerUI from "./LayerUI";
import { ScrollBars } from "../scene/types";
import { invalidateShapeForElement } from "../renderer/renderElement";

import { Library } from "../data/library";
import Scene from "../scene/Scene";
import { MaybeTransformHandleType } from "../element/transformHandles";
import { isValidLibrary } from "../data/json";
import { EVENT_LIBRARY, trackEvent } from "../analytics";
import { Stats } from "./Stats";
import { syncActionResult } from "./App/syncActionResult";
import { handleCanvasPointerDown } from "./App/handleCanvasPointerDown";
import {
  clearSelection,
  clearSelectionIfNotUsingSelection,
  handleSelectionOnPointerDown,
} from "./App/selection";
import { onPointerUpFromPointerDownHandler } from "./App/onPointerUpFromPointerDownHandler";
import { onPointerMoveFromPointerDownHandler } from "./App/onPointerMoveFromPointerDownHandler";
import { handleCanvasPointerMove } from "./App/handleCanvasPointerMove";
import {
  onKeyUp,
  onKeydown,
  onKeyDownFromPointerDownHandler,
  onKeyUpFromPointerDownHandler,
} from "./App/keyboard";
import { handleWheel } from "./App/handleWheel";
import {
  handleCanvasContextMenu,
  maybeOpenContextMenuAfterPointerDownOnTouchDevices,
  openContextMenu,
} from "./App/contextMenu";
import { handleCanvasOnDrop } from "./App/handleCanvasOnDrop";
import { addElementsFromPasteOrLibrary } from "./App/addElementsFromPasteOrLibrary";
import { handleLinearElementOnPointerDown } from "./App/handleLinearElementOnPointerDown";
import { createGenericElementOnPointerDown } from "./App/createGenericElementOnPointerDown";
import { handlePointerMoveOverScrollbars } from "./App/handlePointerMoveOverScrollbars";
import { handleDraggingScrollBar } from "./App/handleDraggingScrollBar";
import { initialPointerDownState } from "./App/initialPointerDownState";
import { handleCanvasPanUsingWheelOrSpaceDrag } from "./App/handleCanvasPanUsingWheelOrSpaceDrag";
import { handleCanvasDoubleClick } from "./App/handleCanvasDoubleClick";
import { maybeDragNewGenericElement } from "./App/maybeDragNewGenericElement";
import { maybeHandleResize } from "./App/maybeHandleResize";
import { componentDidMount } from "./App/componentDidMount";
import { componentDidUpdate } from "./App/componentDidUpdate";
import { savePointer } from "./App/savePointer";
import { onTapEnd, onTapStart } from "./App/tapEvent";
import {
  addTextFromPaste,
  copyAll,
  copyToClipboardAsPng,
  copyToClipboardAsSvg,
  cutAll,
  onCopy,
  onCut,
  pasteFromClipboard,
} from "./App/copyPaste";
import {
  maybeSuggestBindingAtCursor,
  maybeSuggestBindingForAll,
  maybeSuggestBindingForLinearElementAtCursor,
  updateBindingEnabledOnPointerMove,
} from "./App/binding";
import {
  startTextEditing,
  handleTextWysiwyg,
  handleTextOnPointerDown,
  getTextElementAtPosition,
} from "./App/text";
import {
  initializeScene,
  onSceneUpdated,
  resetScene,
  updateScene,
} from "./App/scene";
import { isHittingCommonBoundingBoxOfSelectedElements } from "./App/hitTest";
import { getAllElementsAtPosition, getElementAtPosition } from "./App/element";
import {
  onGestureStart,
  onGestureChange,
  onGestureEnd,
  updateGestureOnPointerDown,
} from "./App/gesture";
import { selectShapeTool } from "./App/selectShapeTool";
import { setScrollToCenter } from "./App/scroll";
import {
  toggleLock,
  toggleZenMode,
  toggleGridMode,
  toggleStats,
} from "./App/settings";

export type PointerDownState = Readonly<{
  // The first position at which pointerDown happened
  origin: Readonly<{ x: number; y: number }>;
  // Same as "origin" but snapped to the grid, if grid is on
  originInGrid: Readonly<{ x: number; y: number }>;
  // Scrollbar checks
  scrollbars: ReturnType<typeof isOverScrollBars>;
  // The previous pointer position
  lastCoords: { x: number; y: number };
  // map of original elements data
  originalElements: Map<string, NonDeleted<ExcalidrawElement>>;
  resize: {
    // Handle when resizing, might change during the pointer interaction
    handleType: MaybeTransformHandleType;
    // This is determined on the initial pointer down event
    isResizing: boolean;
    // This is determined on the initial pointer down event
    offset: { x: number; y: number };
    // This is determined on the initial pointer down event
    arrowDirection: "origin" | "end";
    // This is a center point of selected elements determined on the initial pointer down event (for rotation only)
    center: { x: number; y: number };
  };
  hit: {
    // The element the pointer is "hitting", is determined on the initial
    // pointer down event
    element: NonDeleted<ExcalidrawElement> | null;
    // The elements the pointer is "hitting", is determined on the initial
    // pointer down event
    allHitElements: NonDeleted<ExcalidrawElement>[];
    // This is determined on the initial pointer down event
    wasAddedToSelection: boolean;
    // Whether selected element(s) were duplicated, might change during the
    // pointer interaction
    hasBeenDuplicated: boolean;
    hasHitCommonBoundingBoxOfSelectedElements: boolean;
  };
  drag: {
    // Might change during the pointer interation
    hasOccurred: boolean;
    // Might change during the pointer interation
    offset: { x: number; y: number } | null;
  };
  // We need to have these in the state so that we can unsubscribe them
  eventListeners: {
    // It's defined on the initial pointer down event
    onMove: null | ((event: PointerEvent) => void);
    // It's defined on the initial pointer down event
    onUp: null | ((event: PointerEvent) => void);
    // It's defined on the initial pointer down event
    onKeyDown: null | ((event: KeyboardEvent) => void);
    // It's defined on the initial pointer down event
    onKeyUp: null | ((event: KeyboardEvent) => void);
  };
}>;

export type ExcalidrawImperativeAPI = {
  updateScene: App["updateScene"];
  resetScene: App["resetScene"];
  getSceneElementsIncludingDeleted: typeof App.getSceneElementsIncludingDeleted;
  history: {
    clear: typeof App.resetHistory;
  };
  setScrollToCenter: App["setScrollToCenter"];
  getSceneElements: typeof App.getSceneElements;
  readyPromise: ResolvablePromise<ExcalidrawImperativeAPI>;
  ready: true;
};

class App extends React.Component<ExcalidrawProps, AppState> {
  static defaultProps: Partial<ExcalidrawProps> = {
    width: window.innerWidth,
    height: window.innerHeight,
  };
  static didTapTwice: boolean = false;
  static resetTapTwice() {
    this.didTapTwice = false;
  }
  static tappedTwiceTimer: number = 0;
  static cursor: { x: number; y: number } = { x: 0, y: 0 };
  static isHoldingSpace: boolean = false;
  static isPanning: boolean = false;
  static isDraggingScrollBar: boolean = false;
  static touchTimeout: number = 0;
  static invalidateContextMenu: boolean = false;
  static currentScrollBars: ScrollBars = {
    horizontal: null,
    vertical: null,
  };
  static gesture: Gesture = {
    pointers: new Map(),
    lastCenter: null,
    initialDistance: null,
    initialScale: null,
  };
  static lastPointerUp: ((event: any) => void) | null = null;
  static actionManager: ActionManager;
  static rc: RoughCanvas | null = null;
  static canvas: HTMLCanvasElement | null = null;
  static excalidrawContainerRef = React.createRef<HTMLDivElement>();
  static unmounted: boolean = false;
  static scene: Scene = new Scene();
  static getSceneElementsIncludingDeleted = () => {
    return App.scene.getElementsIncludingDeleted();
  };
  static getSceneElements = () => {
    return App.scene.getElements();
  };
  static history: SceneHistory = createHistory().history;
  static resetHistory = () => {
    App.history.clear();
  };
  static disableEvent: EventHandlerNonNull = (event) => {
    event.preventDefault();
  };
  static getCanvasOffsets(offsets?: {
    offsetLeft?: number;
    offsetTop?: number;
  }): Pick<AppState, "offsetTop" | "offsetLeft"> {
    if (
      typeof offsets?.offsetLeft === "number" &&
      typeof offsets?.offsetTop === "number"
    ) {
      return {
        offsetLeft: offsets.offsetLeft,
        offsetTop: offsets.offsetTop,
      };
    }
    if (App.excalidrawContainerRef?.current?.parentElement) {
      const parentElement = App.excalidrawContainerRef.current.parentElement;
      const { left, top } = parentElement.getBoundingClientRect();
      return {
        offsetLeft:
          typeof offsets?.offsetLeft === "number" ? offsets.offsetLeft : left,
        offsetTop:
          typeof offsets?.offsetTop === "number" ? offsets.offsetTop : top,
      };
    }
    return {
      offsetLeft:
        typeof offsets?.offsetLeft === "number" ? offsets.offsetLeft : 0,
      offsetTop: typeof offsets?.offsetTop === "number" ? offsets.offsetTop : 0,
    };
  }
  static importLibraryFromUrl = async (url: string) => {
    window.history.replaceState({}, APP_NAME, window.location.origin);
    try {
      const request = await fetch(url);
      const blob = await request.blob();
      const json = JSON.parse(await blob.text());
      if (!isValidLibrary(json)) {
        throw new Error();
      }
      if (
        window.confirm(
          t("alerts.confirmAddLibrary", { numShapes: json.library.length }),
        )
      ) {
        await Library.importLibrary(blob);
        trackEvent(EVENT_LIBRARY, "import");
      }
    } catch (error) {
      window.alert(t("alerts.errorLoadingLibrary"));
      console.error(error);
      throw new Error(error);
    }
  };
  // set touch moving for mobile context menu
  static handleTouchMove = (event: React.TouchEvent<HTMLCanvasElement>) => {
    App.invalidateContextMenu = true;
  };
  static maybeCleanupAfterMissingPointerUp(
    event: React.PointerEvent<HTMLCanvasElement>,
  ): void {
    if (App.lastPointerUp !== null) {
      // Unfortunately, sometimes we don't get a pointerup after a pointerdown,
      // this can happen when a contextual menu or alert is triggered. In order to avoid
      // being in a weird state, we clean up on the next pointerdown
      App.lastPointerUp(event);
    }
  }
  static updateCurrentCursorPosition = withBatchedUpdates(
    (event: MouseEvent) => {
      App.cursor.x = event.x;
      App.cursor.y = event.y;
    },
  );
  static removePointer = (event: React.PointerEvent<HTMLElement>) => {
    // remove touch handler for context menu on touch devices
    if (event.pointerType === "touch" && App.touchTimeout) {
      clearTimeout(App.touchTimeout);
      App.touchTimeout = 0;
      App.invalidateContextMenu = false;
    }

    App.gesture.pointers.delete(event.pointerId);
  };

  constructor(props: ExcalidrawProps) {
    super(props);
    const defaultAppState = getDefaultAppState();

    const {
      width = window.innerWidth,
      height = window.innerHeight,
      offsetLeft,
      offsetTop,
      excalidrawRef,
    } = props;
    this.state = {
      ...defaultAppState,
      isLoading: true,
      width,
      height,
      ...App.getCanvasOffsets({ offsetLeft, offsetTop }),
    };
    if (excalidrawRef) {
      const readyPromise =
        ("current" in excalidrawRef && excalidrawRef.current?.readyPromise) ||
        resolvablePromise<ExcalidrawImperativeAPI>();

      const api: ExcalidrawImperativeAPI = {
        ready: true,
        readyPromise,
        updateScene: this.updateScene,
        resetScene: this.resetScene,
        getSceneElementsIncludingDeleted: App.getSceneElementsIncludingDeleted,
        history: {
          clear: App.resetHistory,
        },
        setScrollToCenter: this.setScrollToCenter,
        getSceneElements: App.getSceneElements,
      } as const;
      if (typeof excalidrawRef === "function") {
        excalidrawRef(api);
      } else {
        excalidrawRef.current = api;
      }
      readyPromise.resolve(api);
    }

    App.actionManager = new ActionManager(
      this.syncActionResult,
      () => this.state,
      () => App.scene.getElementsIncludingDeleted(),
    );
    App.actionManager.registerAll(actions);

    App.actionManager.registerAction(createUndoAction(App.history));
    App.actionManager.registerAction(createRedoAction(App.history));
  }

  render() {
    const {
      zenModeEnabled,
      width: canvasDOMWidth,
      height: canvasDOMHeight,
      offsetTop,
      offsetLeft,
    } = this.state;

    const { onCollabButtonClick, onExportToBackend } = this.props;
    const canvasScale = window.devicePixelRatio;

    const canvasWidth = canvasDOMWidth * canvasScale;
    const canvasHeight = canvasDOMHeight * canvasScale;

    const DEFAULT_PASTE_X = canvasDOMWidth / 2;
    const DEFAULT_PASTE_Y = canvasDOMHeight / 2;

    return (
      <div
        className="excalidraw"
        ref={App.excalidrawContainerRef}
        style={{
          width: canvasDOMWidth,
          height: canvasDOMHeight,
          top: offsetTop,
          left: offsetLeft,
        }}
      >
        <LayerUI
          canvas={App.canvas}
          appState={this.state}
          setAppState={this.setAppState}
          actionManager={App.actionManager}
          elements={App.scene.getElements()}
          onCollabButtonClick={onCollabButtonClick}
          onLockToggle={this.toggleLock}
          onInsertShape={(elements) =>
            this.addElementsFromPasteOrLibrary(
              elements,
              DEFAULT_PASTE_X,
              DEFAULT_PASTE_Y,
            )
          }
          zenModeEnabled={zenModeEnabled}
          toggleZenMode={this.toggleZenMode}
          lng={getLanguage().lng}
          isCollaborating={this.props.isCollaborating || false}
          onExportToBackend={onExportToBackend}
        />
        {this.state.showStats && (
          <Stats
            appState={this.state}
            elements={App.scene.getElements()}
            onClose={this.toggleStats}
          />
        )}
        <main>
          <canvas
            id="canvas"
            style={{
              width: canvasDOMWidth,
              height: canvasDOMHeight,
            }}
            width={canvasWidth}
            height={canvasHeight}
            ref={this.handleCanvasRef}
            onContextMenu={this.handleCanvasContextMenu}
            onPointerDown={this.handleCanvasPointerDown}
            onDoubleClick={this.handleCanvasDoubleClick}
            onPointerMove={this.handleCanvasPointerMove}
            onPointerUp={App.removePointer}
            onPointerCancel={App.removePointer}
            onTouchMove={App.handleTouchMove}
            onDrop={this.handleCanvasOnDrop}
          >
            {t("labels.drawingCanvas")}
          </canvas>
        </main>
      </div>
    );
  }
  // Collaboration
  setAppState = (obj: any) => {
    this.setState(obj);
  };
  syncActionResult = syncActionResult(this);
  onBlur = withBatchedUpdates(() => {
    App.isHoldingSpace = false;
    this.setState({ isBindingEnabled: true });
  });
  onUnload = () => {
    this.onBlur();
  };
  onFontLoaded = () => {
    App.scene.getElementsIncludingDeleted().forEach((element) => {
      if (isTextElement(element)) {
        invalidateShapeForElement(element);
      }
    });
    this.onSceneUpdated();
  };
  importLibraryFromUrl = async (url: string) => {
    await App.importLibraryFromUrl(url);
    this.setState({
      isLibraryOpen: true,
    });
  };
  /**
   * Resets scene & history.
   * ! Do not use to clear scene user action !
   */
  resetScene = resetScene(this);
  initializeScene = initializeScene(this);
  componentDidMount = componentDidMount(this);

  componentWillUnmount() {
    App.unmounted = true;
    this.removeEventListeners();
    App.scene.destroy();
    clearTimeout(App.touchTimeout);
    App.touchTimeout = 0;
  }
  onResize = withBatchedUpdates(() => {
    App.scene
      .getElementsIncludingDeleted()
      .forEach((element) => invalidateShapeForElement(element));
    this.setState({});
  });
  removeEventListeners() {
    document.removeEventListener(EVENT.COPY, this.onCopy);
    document.removeEventListener(EVENT.PASTE, this.pasteFromClipboard);
    document.removeEventListener(EVENT.CUT, this.onCut);

    document.removeEventListener(EVENT.KEYDOWN, this.onKeyDown, false);
    document.removeEventListener(
      EVENT.MOUSE_MOVE,
      App.updateCurrentCursorPosition,
      false,
    );
    document.removeEventListener(EVENT.KEYUP, this.onKeyUp);
    window.removeEventListener(EVENT.RESIZE, this.onResize, false);
    window.removeEventListener(EVENT.UNLOAD, this.onUnload, false);
    window.removeEventListener(EVENT.BLUR, this.onBlur, false);
    window.removeEventListener(EVENT.DRAG_OVER, App.disableEvent, false);
    window.removeEventListener(EVENT.DROP, App.disableEvent, false);

    document.removeEventListener(
      EVENT.GESTURE_START,
      this.onGestureStart as any,
      false,
    );
    document.removeEventListener(
      EVENT.GESTURE_CHANGE,
      this.onGestureChange as any,
      false,
    );
    document.removeEventListener(
      EVENT.GESTURE_END,
      this.onGestureEnd as any,
      false,
    );
  }
  addEventListeners() {
    document.addEventListener(EVENT.COPY, this.onCopy);
    document.addEventListener(EVENT.PASTE, this.pasteFromClipboard);
    document.addEventListener(EVENT.CUT, this.onCut);

    document.addEventListener(EVENT.KEYDOWN, this.onKeyDown, false);
    document.addEventListener(EVENT.KEYUP, this.onKeyUp, { passive: true });
    document.addEventListener(
      EVENT.MOUSE_MOVE,
      App.updateCurrentCursorPosition,
    );
    window.addEventListener(EVENT.RESIZE, this.onResize, false);
    window.addEventListener(EVENT.UNLOAD, this.onUnload, false);
    window.addEventListener(EVENT.BLUR, this.onBlur, false);
    window.addEventListener(EVENT.DRAG_OVER, App.disableEvent, false);
    window.addEventListener(EVENT.DROP, App.disableEvent, false);

    // rerender text elements on font load to fix #637 && #1553
    document.fonts?.addEventListener?.("loadingdone", this.onFontLoaded);

    // Safari-only desktop pinch zoom
    document.addEventListener(
      EVENT.GESTURE_START,
      this.onGestureStart as any,
      false,
    );
    document.addEventListener(
      EVENT.GESTURE_CHANGE,
      this.onGestureChange as any,
      false,
    );
    document.addEventListener(
      EVENT.GESTURE_END,
      this.onGestureEnd as any,
      false,
    );
  }
  componentDidUpdate = componentDidUpdate(this);
  addElementsFromPasteOrLibrary = addElementsFromPasteOrLibrary(this);
  addTextFromPaste = addTextFromPaste(this);
  // App settings toggle
  toggleLock = toggleLock(this);
  toggleZenMode = toggleZenMode(this);
  toggleGridMode = toggleGridMode(this);
  toggleStats = toggleStats(this);

  setScrollToCenter = setScrollToCenter(this);

  // Scene
  updateScene = updateScene(this);
  onSceneUpdated = onSceneUpdated(this);

  // Input handling
  // Copy/paste
  onCut = onCut(this);
  onCopy = onCopy(this);
  cutAll = cutAll(this);
  copyAll = copyAll(this);
  copyToClipboardAsPng = copyToClipboardAsPng(this);
  copyToClipboardAsSvg = copyToClipboardAsSvg(this);
  pasteFromClipboard = pasteFromClipboard(this);

  // Tap events
  onTapStart = onTapStart(this);
  onTapEnd = onTapEnd(this);

  // Handle keyboard event
  onKeyDown = onKeydown(this);
  onKeyUp = onKeyUp(this);
  onKeyDownFromPointerDownHandler = onKeyDownFromPointerDownHandler(this);
  onKeyUpFromPointerDownHandler = onKeyUpFromPointerDownHandler(this);

  selectShapeTool = selectShapeTool(this);

  // Handle gesture event
  onGestureStart = onGestureStart(this);
  onGestureChange = onGestureChange(this);
  onGestureEnd = onGestureEnd(this);
  updateGestureOnPointerDown = updateGestureOnPointerDown(this);
  getElementAtPosition = getElementAtPosition(this);
  getElementsAtPosition = getAllElementsAtPosition(this);

  // Handle Text
  startTextEditing = startTextEditing(this);
  handleTextWysiwyg = handleTextWysiwyg(this);
  handleCanvasDoubleClick = handleCanvasDoubleClick(this);
  handleCanvasPointerMove = handleCanvasPointerMove(this);
  handleCanvasPointerDown = handleCanvasPointerDown(this);
  getTextElementAtPosition = getTextElementAtPosition(this);
  maybeOpenContextMenuAfterPointerDownOnTouchDevices = maybeOpenContextMenuAfterPointerDownOnTouchDevices(
    this,
  );
  // Returns whether the event is a panning
  handleCanvasPanUsingWheelOrSpaceDrag = handleCanvasPanUsingWheelOrSpaceDrag(
    this,
  );
  initialPointerDownState = initialPointerDownState(this);
  // Returns whether the event is a dragging a scrollbar
  handleDraggingScrollBar = handleDraggingScrollBar(this);
  clearSelectionIfNotUsingSelection = clearSelectionIfNotUsingSelection(this);
  /**
   * @returns whether the pointer event has been completely handled
   */
  handleSelectionOnPointerDown = handleSelectionOnPointerDown(this);
  isASelectedElement(hitElement: ExcalidrawElement | null): boolean {
    return hitElement != null && this.state.selectedElementIds[hitElement.id];
  }
  isHittingCommonBoundingBoxOfSelectedElements = isHittingCommonBoundingBoxOfSelectedElements(
    this,
  );
  handleTextOnPointerDown = handleTextOnPointerDown(this);
  handleLinearElementOnPointerDown = handleLinearElementOnPointerDown(this);
  createGenericElementOnPointerDown = createGenericElementOnPointerDown(this);
  onPointerMoveFromPointerDownHandler = onPointerMoveFromPointerDownHandler(
    this,
  );
  // Returns whether the pointer move happened over either scrollbar
  handlePointerMoveOverScrollbars = handlePointerMoveOverScrollbars(this);
  onPointerUpFromPointerDownHandler = onPointerUpFromPointerDownHandler(this);
  // binding
  updateBindingEnabledOnPointerMove = updateBindingEnabledOnPointerMove(this);
  maybeSuggestBindingAtCursor = maybeSuggestBindingAtCursor(this);
  maybeSuggestBindingForLinearElementAtCursor = maybeSuggestBindingForLinearElementAtCursor(
    this,
  );
  maybeSuggestBindingForAll = maybeSuggestBindingForAll(this);
  clearSelection = clearSelection(this);
  handleCanvasRef = (canvas: HTMLCanvasElement) => {
    // canvas is null when unmounting
    if (canvas !== null) {
      App.canvas = canvas;
      App.rc = rough.canvas(App.canvas);

      App.canvas.addEventListener(EVENT.WHEEL, this.handleWheel, {
        passive: false,
      });
      App.canvas.addEventListener(EVENT.TOUCH_START, this.onTapStart);
      App.canvas.addEventListener(EVENT.TOUCH_END, this.onTapEnd);
    } else {
      App.canvas?.removeEventListener(EVENT.WHEEL, this.handleWheel);
      App.canvas?.removeEventListener(EVENT.TOUCH_START, this.onTapStart);
      App.canvas?.removeEventListener(EVENT.TOUCH_END, this.onTapEnd);
    }
  };
  handleCanvasOnDrop = handleCanvasOnDrop(this);
  handleCanvasContextMenu = handleCanvasContextMenu(this);
  maybeDragNewGenericElement = maybeDragNewGenericElement(this);
  maybeHandleResize = maybeHandleResize(this);
  openContextMenu = openContextMenu(this);
  handleWheel = handleWheel(this);
  savePointer = savePointer(this);
  resetShouldCacheIgnoreZoomDebounced = debounce(() => {
    this.setState({ shouldCacheIgnoreZoom: false });
  }, 300);
}

// -----------------------------------------------------------------------------
// TEST HOOKS
// -----------------------------------------------------------------------------

declare global {
  interface Window {
    h: {
      elements: readonly ExcalidrawElement[];
      state: AppState;
      setState: React.Component<any, AppState>["setState"];
      history: SceneHistory;
      app: App;
      library: typeof Library;
      collab: InstanceType<
        typeof import("../excalidraw-app/collab/CollabWrapper").default
      >;
    };
  }
}

if (
  process.env.NODE_ENV === ENV.TEST ||
  process.env.NODE_ENV === ENV.DEVELOPMENT
) {
  window.h = window.h || ({} as Window["h"]);

  Object.defineProperties(window.h, {
    elements: {
      configurable: true,
      get() {
        return App.scene.getElementsIncludingDeleted();
      },
      set(elements: ExcalidrawElement[]) {
        return App.scene.replaceAllElements(elements);
      },
    },
    history: {
      configurable: true,
      get: () => App.history,
    },
    library: {
      configurable: true,
      value: Library,
    },
  });
}
export default App;
