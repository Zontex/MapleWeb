import MapleMap from "./MapleMap";
import MyCharacter from "./MyCharacter";
import Camera, { CameraInterface } from "./Camera";
import { enterBrowserFullscreen } from "./Config";
import GameCanvas from "./GameCanvas";
import UIMap from "./UI/UIMap";
import StatsMenuSprite from "./UI/Menu/StatsMenuSprite";
import InventoryMenuSprite from "./UI/Menu/InventoryMenuSprite";
import TouchJoyStick, {
  JoyStick,
  JoyStickDirections,
} from "./UI/TouchJoyStick";
import ClickManager from "./UI/ClickManager";
import TaxiUI from "./UI/TaxiUI";
import WZManager from "./wz-utils/WZManager";

// henesys 100000000
// 100020100 - maps with pigs - useful to test fast things with mobs
// const defaultMap = 100020100; // maps with pigs
const defaultMap = 100000000; // henesys
// const defaultMap = 104040000; // left of henesys
// const defaultMap: number = 100040102; // elinia - monkey map

export interface MapState {
  initialize: (map?: number) => Promise<void>;
  changeMap: (map: number) => Promise<void>;
  doUpdate: (
    msPerTick: number,
    camera: CameraInterface,
    canvas: GameCanvas
  ) => void;
  doRender: (
    canvas: GameCanvas,
    camera: CameraInterface,
    lag: number,
    msPerTick: number,
    tdelta: number
  ) => void;
  isTouchControllsEnabled: boolean;
  joyStick: JoyStick;
  statsMenu: StatsMenuSprite;
  inventoryMenu: InventoryMenuSprite;
  UIMenus: any[];
  PlayerCharacter: any; // Reference to MyCharacter
  getMapName: (mapId: number) => Promise<{ streetName: string, mapName: string }>;
  previousKeyboardState: {
    up: boolean;
    down: boolean;
    left: boolean;
    right: boolean;
    i: boolean;
    s: boolean;
  };
}

const MapStateInstance = {} as MapState;

async function initializeMapState(map = defaultMap, isFirstUpdate = false) {
  await MyCharacter.load();
  MyCharacter.activate();
  // Henesys
  await MapleMap.load(map);

  MyCharacter.map = MapleMap;

  if (isFirstUpdate) {
    // todo: additional UI initialization if needed
    await UIMap.initialize();
  }

  const xMid = Math.floor(
    (MapleMap.boundaries.right + MapleMap.boundaries.left) / 2
  );
  const yMid = Math.floor(
    (MapleMap.boundaries.bottom + MapleMap.boundaries.top) / 2
  );

  MyCharacter.pos.x = xMid;
  MyCharacter.pos.y = yMid;
}

MapStateInstance.changeMap = async function (map = defaultMap) {
  await initializeMapState(map);
};

function isTouchDevice() {
  return "ontouchstart" in window || navigator.maxTouchPoints > 0;
}

// Function to get map names from the String.wz/Map.img file
MapStateInstance.getMapName = async function(mapId: number) {
  try {
    const strMap = await WZManager.get("String.wz/Map.img");
    
    const firstDigit = Math.floor(mapId / 100000000);
    const firstTwoDigits = Math.floor(mapId / 10000000);
    const firstThreeDigits = Math.floor(mapId / 1000000);
    
    let area = "maple";
    if (firstTwoDigits === 54) {
      area = "singapore";
    } else if (firstDigit === 9) {
      area = "etc";
    } else if (firstDigit === 8) {
      area = "jp";
    } else if (firstThreeDigits === 682) {
      area = "HalloweenGL";
    } else if (firstTwoDigits === 60 || firstTwoDigits === 61) {
      area = "MasteriaGL";
    } else if (firstTwoDigits === 67 || firstTwoDigits === 68) {
      area = "weddingGL";
    } else if (firstDigit === 2) {
      area = "ossyria";
    } else if (firstDigit === 1) {
      area = "victoria";
    }
    
    const nameNode = strMap[area]?.[mapId];
    const streetName = nameNode?.streetName?.nValue || "";
    const mapName = nameNode?.mapName?.nValue || `Map ${mapId}`;
    
    return { streetName, mapName };
  } catch (error) {
    console.error(`Error getting map name for ${mapId}:`, error);
    return { streetName: "", mapName: `Map ${mapId}` };
  }
};

MapStateInstance.initialize = async function (map: number = defaultMap) {
  this.isTouchControllsEnabled = isTouchDevice(); // Check if the device supports touch
  if (this.isTouchControllsEnabled) {
    this.joyStick = TouchJoyStick.init();
  }

  this.statsMenu = await StatsMenuSprite.fromOpts({
    x: 200,
    y: 200,
    charecter: MyCharacter,
    isHidden: true,
  });
  
  // We'll use ClickManager's GameCanvas reference instead
  this.inventoryMenu = await InventoryMenuSprite.fromOpts({
    x: 400,
    y: 200,
    charecter: MyCharacter,
    isHidden: true,
    canvas: ClickManager.GameCanvas, // Pass the canvas for mouse interaction
  });

  this.UIMenus = [this.statsMenu, this.inventoryMenu];
  
  // Set a reference to the player character for TaxiUI
  this.PlayerCharacter = MyCharacter;

  // Initialize previous keyboard state with all keys set to false.
  this.previousKeyboardState = {
    up: false,
    down: false,
    left: false,
    right: false,
    i: false,
    s: false,
  };

  await initializeMapState(map, true);

  // --- Attach click event listener to the canvas element using the correct id ---
  const canvasElement = document.getElementById("game"); // updated to "game"
  if (canvasElement) {
    canvasElement.addEventListener("click", (event) => {
      MapleMap.handleClick(event, canvasElement, Camera);
    });
  } else {
    console.warn("Canvas element with id 'game' not found.");
  }
};

MapStateInstance.doUpdate = function (
  msPerTick: number,
  camera: CameraInterface,
  canvas: GameCanvas
) {
  if (!!MapleMap.doneLoading) {
    MapleMap.update(msPerTick);

    // Update TaxiUI
    if (TaxiUI.isVisible) {
      TaxiUI.update(msPerTick);
      // Don't return early, continue updating the game state
      // This allows the TaxiUI to handle clicks while game runs in background
    }

    if (this.isTouchControllsEnabled) {
      switch (this.joyStick.cardinalDirection) {
        case JoyStickDirections.N:
          MyCharacter.upClick();
          break;
        case JoyStickDirections.S:
          MyCharacter.downClick();
          break;
        case JoyStickDirections.E:
          MyCharacter.rightClick();
          break;
        case JoyStickDirections.W:
          MyCharacter.leftClick();
          break;
        case JoyStickDirections.NE:
          MyCharacter.upClick();
          MyCharacter.rightClick();
          break;
        case JoyStickDirections.NW:
          MyCharacter.upClick();
          MyCharacter.leftClick();
          break;
        case JoyStickDirections.SE:
          MyCharacter.downClick();
          MyCharacter.rightClick();
          break;
        case JoyStickDirections.SW:
          MyCharacter.downClick();
          MyCharacter.leftClick();
          break;
        case JoyStickDirections.C:
          MyCharacter.downClickRelease();
          MyCharacter.upClickRelease();
          MyCharacter.leftClickRelease();
          MyCharacter.rightClickRelease();
          break;
        default:
          break;
      }
      MyCharacter.update(msPerTick);
    } else {
      if (canvas.isKeyDown("up")) {
        MyCharacter.upClick();
      }
      if (canvas.isKeyDown("down")) {
        MyCharacter.downClick();
      }
      if (canvas.isKeyDown("left")) {
        MyCharacter.leftClick();
      }
      if (canvas.isKeyDown("right")) {
        MyCharacter.rightClick();
      }
      if (canvas.isKeyDown("alt")) {
        MyCharacter.jump();
      }
      if (canvas.isKeyDown("ctrl")) {
        MyCharacter.attack();
      }
      if (canvas.isKeyDown("z")) {
        MyCharacter.pickUp();
      }

      if (canvas.isKeyDown("s") && !this.previousKeyboardState.s) {
        this.statsMenu.setIsHidden(!this.statsMenu.isHidden);
      }
      if (canvas.isKeyDown("i") && !this.previousKeyboardState.i) {
        this.inventoryMenu.setIsHidden(!this.inventoryMenu.isHidden);
      }

      if (canvas.isKeyDown("esc")) {
        // First check if taxi UI is open
        if (TaxiUI.isVisible) {
          TaxiUI.hide();
        } else {
          const notHiddenMenus = this.UIMenus.filter((menu) => !menu.isHidden);
          if (notHiddenMenus.length > 0) {
            notHiddenMenus[notHiddenMenus.length - 1].setIsHidden(true);
          }
        }
      }

      MyCharacter.update(msPerTick);

      if (!canvas.isKeyDown("up")) {
        MyCharacter.upClickRelease();
      }
      if (!canvas.isKeyDown("down")) {
        MyCharacter.downClickRelease();
      }
      if (!canvas.isKeyDown("left")) {
        MyCharacter.leftClickRelease();
      }
      if (!canvas.isKeyDown("right")) {
        MyCharacter.rightClickRelease();
      }
    }

    this.previousKeyboardState.i = canvas.isKeyDown("i");
    this.previousKeyboardState.s = canvas.isKeyDown("s");
    this.previousKeyboardState.up = canvas.isKeyDown("up");
    this.previousKeyboardState.down = canvas.isKeyDown("down");
    this.previousKeyboardState.left = canvas.isKeyDown("left");
    this.previousKeyboardState.right = canvas.isKeyDown("right");

    Camera.lookAt(MyCharacter.pos.x, MyCharacter.pos.y - 78);

    UIMap.doUpdate(msPerTick, camera, canvas);

    this.UIMenus.forEach((menu) => {
      menu.update(msPerTick, camera, canvas);
    });
  }
};

MapStateInstance.doRender = function (
  canvas: GameCanvas,
  camera: CameraInterface,
  lag: number,
  msPerTick: number,
  tdelta: number
) {
  if (!!MapleMap.doneLoading) {
    MapleMap.render(canvas, camera, lag, msPerTick, tdelta);

    if (!!MyCharacter.active) {
      MyCharacter.draw(canvas, camera, lag, msPerTick, tdelta);
    }

    this.UIMenus.forEach((menu) => {
      menu.draw(canvas, camera, lag, msPerTick, tdelta);
    });

    UIMap.doRender(canvas, camera, lag, msPerTick, tdelta);
    
    // Draw TaxiUI on top of everything else
    if (TaxiUI.isVisible) {
      console.log("MapState is rendering TaxiUI");
      TaxiUI.render(canvas, camera);
    } else {
      // console.log("TaxiUI is not visible in MapState render");
    }
  }
};

declare global {
  interface Window {
    MapStateInstance: MapState;
  }
}

// Expose MapStateInstance globally
window.MapStateInstance = MapStateInstance;

export default MapStateInstance;
