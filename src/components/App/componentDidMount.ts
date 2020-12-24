import { ENV } from "../../constants";
import App from "../App";

export const componentDidMount = ($app: App) => () => {
  if (
    process.env.NODE_ENV === ENV.TEST ||
    process.env.NODE_ENV === ENV.DEVELOPMENT
  ) {
    const setState = $app.setState.bind(this);
    Object.defineProperties(window.h, {
      state: {
        configurable: true,
        get: () => {
          return $app.state;
        },
      },
      setState: {
        configurable: true,
        value: (...args: Parameters<typeof setState>) => {
          return $app.setState(...args);
        },
      },
      app: {
        configurable: true,
        value: this,
      },
    });
  }

  App.scene.addCallback($app.onSceneUpdated);

  $app.addEventListeners();

  // optim to avoid extra render on init
  if (
    typeof $app.props.offsetLeft === "number" &&
    typeof $app.props.offsetTop === "number"
  ) {
    $app.initializeScene();
  } else {
    $app.setState(App.getCanvasOffsets($app.props), () => {
      $app.initializeScene();
    });
  }
};
