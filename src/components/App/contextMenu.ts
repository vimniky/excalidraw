import {
  probablySupportsClipboardBlob,
  probablySupportsClipboardWriteText,
} from "../../clipboard";
import { CANVAS_ONLY_ACTIONS, TOUCH_CTX_MENU_TIMEOUT } from "../../constants";
import { t } from "../../i18n";
import { viewportCoordsToSceneCoords } from "../../utils";
import App from "../App";
import ContextMenu from "../ContextMenu";

export const openContextMenu = ($app: App) => ({
  clientX,
  clientY,
}: {
  clientX: number;
  clientY: number;
}) => {
  const { x, y } = viewportCoordsToSceneCoords(
    { clientX, clientY },
    $app.state,
  );

  const elements = App.scene.getElements();
  const element = $app.getElementAtPosition(x, y);
  if (!element) {
    ContextMenu.push({
      options: [
        navigator.clipboard && {
          shortcutName: "paste",
          label: t("labels.paste"),
          action: () => $app.pasteFromClipboard(null),
        },
        probablySupportsClipboardBlob &&
          elements.length > 0 && {
            shortcutName: "copyAsPng",
            label: t("labels.copyAsPng"),
            action: $app.copyToClipboardAsPng,
          },
        probablySupportsClipboardWriteText &&
          elements.length > 0 && {
            shortcutName: "copyAsSvg",
            label: t("labels.copyAsSvg"),
            action: $app.copyToClipboardAsSvg,
          },
        ...App.actionManager.getContextMenuItems((action) =>
          CANVAS_ONLY_ACTIONS.includes(action.name),
        ),
        {
          checked: $app.state.gridSize !== null,
          shortcutName: "gridMode",
          label: t("labels.gridMode"),
          action: $app.toggleGridMode,
        },
        {
          checked: $app.state.showStats,
          shortcutName: "stats",
          label: t("stats.title"),
          action: $app.toggleStats,
        },
      ],
      top: clientY,
      left: clientX,
    });
    return;
  }

  if (!$app.state.selectedElementIds[element.id]) {
    $app.setState({ selectedElementIds: { [element.id]: true } });
  }

  ContextMenu.push({
    options: [
      {
        shortcutName: "cut",
        label: t("labels.cut"),
        action: $app.cutAll,
      },
      navigator.clipboard && {
        shortcutName: "copy",
        label: t("labels.copy"),
        action: $app.copyAll,
      },
      navigator.clipboard && {
        shortcutName: "paste",
        label: t("labels.paste"),
        action: () => $app.pasteFromClipboard(null),
      },
      probablySupportsClipboardBlob && {
        shortcutName: "copyAsPng",
        label: t("labels.copyAsPng"),
        action: $app.copyToClipboardAsPng,
      },
      probablySupportsClipboardWriteText && {
        shortcutName: "copyAsSvg",
        label: t("labels.copyAsSvg"),
        action: $app.copyToClipboardAsSvg,
      },
      ...App.actionManager.getContextMenuItems(
        (action) => !CANVAS_ONLY_ACTIONS.includes(action.name),
      ),
    ],
    top: clientY,
    left: clientX,
  });
};

export const maybeOpenContextMenuAfterPointerDownOnTouchDevices = (
  $app: App,
) => (event: React.PointerEvent<HTMLCanvasElement>): void => {
  // deal with opening context menu on touch devices
  if (event.pointerType === "touch") {
    App.invalidateContextMenu = false;

    if (App.touchTimeout) {
      // If there's already a touchTimeout, this means that there's another
      // touch down and we are doing another touch, so we shouldn't open the
      // context menu.
      App.invalidateContextMenu = true;
    } else {
      // open the context menu with the first touch's clientX and clientY
      // if the touch is not moving
      App.touchTimeout = window.setTimeout(() => {
        App.touchTimeout = 0;
        if (!App.invalidateContextMenu) {
          $app.openContextMenu({
            clientX: event.clientX,
            clientY: event.clientY,
          });
        }
      }, TOUCH_CTX_MENU_TIMEOUT);
    }
  }
};

export const handleCanvasContextMenu = ($app: App) => (
  event: React.PointerEvent<HTMLCanvasElement>,
) => {
  event.preventDefault();
  $app.openContextMenu(event);
};
