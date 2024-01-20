import type { Viewfinder } from "scandit-web-datacapture-core";
import {
  Camera,
  CameraSwitchControl,
  DataCaptureContext,
  DataCaptureView,
  FrameSourceState,
  RectangularViewfinder,
  RectangularViewfinderLineStyle,
  RectangularViewfinderStyle,
  configure,
} from "scandit-web-datacapture-core";
import type { Barcode, BarcodeCaptureSession } from "scandit-web-datacapture-barcode";
import {
  BarcodeCapture,
  BarcodeCaptureOverlay,
  BarcodeCaptureOverlayStyle,
  BarcodeCaptureSettings,
  Symbology,
  SymbologyDescription,
  barcodeCaptureLoader,
} from "scandit-web-datacapture-barcode";

declare global {
  interface Window {
    continueScanning: () => void;
  }
}

async function run(): Promise<void> {
  // To visualize the ongoing loading process on screen, the view must be connected before the configure phase.
  const view = new DataCaptureView();

  // Connect the data capture view to the HTML element.
  view.connectToElement(document.getElementById("data-capture-view")!);

  // Show the progress bar
  view.showProgressBar();

  // There is a Scandit sample license key set below here.
  // This license key is enabled for sample evaluation only.
  // If you want to build your own application, get your license key by signing up for a trial at https://ssl.scandit.com/dashboard/sign-up?p=test
  // The passed parameter represents the location of the wasm file, which will be fetched asynchronously.
  // You must `await` the returned promise to be able to continue.
  await configure({
    licenseKey: "AW7z5wVbIbJtEL1x2i7B3/cet/ClBNVHZTfPtvJ2n3L/LY6/FDbqtzYItFO0DmhIJ2JP1Vxu7po1f74HqF9UTtRB/1DHY+CJdTiq/6dQ8vFgd9rzwlVfSYFgWPp9fK5nVUmnHyt9W5oRMcXObjYeC7Q/FO0NA0yRHUEtt/aBpnv/AxYTKG8wyVNqZKMJn+bhz/CFbH5pjtdj2aE85TlPGfQK4sBP/K2ONcx2ndbmY82SOquLlcZ55uAFuj4yCuQEI6iuokblpDVsql+vDiw3XMOmqwbmuGnAuCtGbtjyyWyQCKeiKWtZzdy+Cz7NnW/yRdwKY1xBjkaMA+A+NWeBxp9O2Ou6dBCPsRPg0Nqfv92sbv050dQc/+xccvEXWSi8UnD+AQoKp5V3gR/Yae/5+4fII9X3Tqjf/aNvXDw3m7YDQ+b+IJnkzLN5EgwGnzUmI8z3qMx9xcqhkWwBE/SSuIP47tBp5xwz02kN6qb+vZc/1p5EUQ/VtGVBfD1e+5Dii56BHsfPId/JpKpGUX1FFAYuT1uEbf7xLREDtFobn05tDxYPLrCa0hciRwCdWxHbUnYR1BF3zQQHih5Dd5qGyA5yKsgCsg7Na+9gC8O6hxpWlB4SbIFMEDluvJ+0v0ww5nnP2PWAO7v4k+Sgn7cQa7gDhQNee+pfuDvUlprUufio+dUmOUYNbn2TVwRVATmPx4U+p8Acg+Ohj85bSwPk+cNoq3Te6N0Ts5JnwrjCvVq6yrfbqyGFbgIhJiSxtgiZOfMZu8KoCvBfIUFE2A5WlNNaMZmQAtPozR31iX/Z2LuCIBhkFXGdd9CW/YPKhs8m25jlbOKnl0DWiBnM",
    libraryLocation: new URL("../../library/engine/", document.baseURI).toString(),
    moduleLoaders: [barcodeCaptureLoader()],
  });

  // Hide the progress bar
  view.hideProgressBar();

  // Create the data capture context.
  const context: DataCaptureContext = await DataCaptureContext.create();

  // To visualize the ongoing barcode capturing process on screen, set up a data capture view that renders the
  // camera preview. The view must be connected to the data capture context.
  await view.setContext(context);

  // Try to use the world-facing (back) camera and set it as the frame source of the context. The camera is off by
  // default and must be turned on to start streaming frames to the data capture context for recognition.
  const camera: Camera = Camera.default;
  await context.setFrameSource(camera);

  // The barcode capturing process is configured through barcode capture settings,
  // they are then applied to the barcode capture instance that manages barcode recognition.
  const settings: BarcodeCaptureSettings = new BarcodeCaptureSettings();

  // Filter out duplicate barcodes for 1 second.
  settings.codeDuplicateFilter = 1000;

  // The settings instance initially has all types of barcodes (symbologies) disabled. For the purpose of this
  // sample we enable a very generous set of symbologies. In your own app ensure that you only enable the
  // symbologies that your app requires as every additional enabled symbology has an impact on processing times.
  settings.enableSymbologies([
    Symbology.EAN13UPCA,
    Symbology.EAN8,
    Symbology.UPCE,
    Symbology.QR,
    Symbology.DataMatrix,
    Symbology.Code39,
    Symbology.Code128,
    Symbology.InterleavedTwoOfFive,
  ]);

  // Create a new barcode capture mode with the settings from above.
  const barcodeCapture = await BarcodeCapture.forContext(context, settings);
  // Disable the barcode capture mode until the camera is accessed.
  await barcodeCapture.setEnabled(false);

  // Register a listener to get informed whenever a new barcode got recognized.
  barcodeCapture.addListener({
    didScan: async (barcodeCaptureMode: BarcodeCapture, session: BarcodeCaptureSession) => {
      const barcode: Barcode = session.newlyRecognizedBarcodes[0];
      const symbology: SymbologyDescription = new SymbologyDescription(barcode.symbology);
      // Hide the viewfinder.
      await barcodeCaptureOverlay.setViewfinder(null);
      // Disable the capture of barcodes until the user closes the displayed result.
      await barcodeCapture.setEnabled(false);
      showResult(`${symbology.readableName}: ${barcode.data!}\nSymbol count: ${barcode.symbolCount}`);
    },
  });

  // Add a control to be able to switch cameras.
  view.addControl(new CameraSwitchControl());

  // Add a barcode capture overlay to the data capture view to render the location of captured barcodes on top of
  // the video preview. This is optional, but recommended for better visual feedback.
  const barcodeCaptureOverlay = await BarcodeCaptureOverlay.withBarcodeCaptureForViewWithStyle(
    barcodeCapture,
    view,
    BarcodeCaptureOverlayStyle.Frame
  );
  const viewfinder: Viewfinder = new RectangularViewfinder(
    RectangularViewfinderStyle.Square,
    RectangularViewfinderLineStyle.Light
  );
  await barcodeCaptureOverlay.setViewfinder(viewfinder);

  // Switch the camera on to start streaming frames.
  await camera.switchToDesiredState(FrameSourceState.On);
  await barcodeCapture.setEnabled(true);

  function showResult(result: string): void {
    const resultElement = document.createElement("div");
    resultElement.className = "result";
    resultElement.innerHTML = `
      <p class="result-header">Scan Results</p>
      <p class="result-text"></p>
      <button onclick="continueScanning()">OK</button>
    `;
    document.querySelector("#data-capture-view")!.append(resultElement);
    document.querySelector("#data-capture-view .result-text")!.textContent = result;
  }

  window.continueScanning = async function continueScanning() {
    for (const r of document.querySelectorAll(".result")!) r.remove();
    await barcodeCapture.setEnabled(true);
    await barcodeCaptureOverlay.setViewfinder(viewfinder);
  };
}

run().catch((error) => {
  console.error(error);
  alert(JSON.stringify(error, null, 2));
});
