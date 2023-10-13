import * as SDCCore from "scandit-web-datacapture-core";
import * as SDCBarcode from "scandit-web-datacapture-barcode";

function removeAllChildNodes(parent: Node): void {
  while (parent.firstChild) {
    parent.firstChild.remove();
  }
}

async function run(): Promise<void> {
  // To visualize the ongoing loading process on screen, the view must be connected before the configure phase.
  const view = new SDCCore.DataCaptureView();

  // Connect the data capture view to the HTML element.
  view.connectToElement(document.getElementById("data-capture-view")!);

  // Set the progress bar message
  view.setProgressBarMessage("Loading...");

  // Show the loading layer
  view.showProgressBar();
  // There is a Scandit sample license key set below here.
  // This license key is enabled for sample evaluation only.
  // If you want to build your own application, get your license key by signing up for a trial at https://ssl.scandit.com/dashboard/sign-up?p=test
  // The passed parameter represents the location of the wasm file, which will be fetched asynchronously.
  // You must `await` the returned promise to be able to continue.
  await SDCCore.configure({
    licenseKey: "-- ENTER YOUR SCANDIT LICENSE KEY HERE --",
    libraryLocation: new URL("library/engine/", document.baseURI).toString(),
    moduleLoaders: [SDCBarcode.barcodeCaptureLoader({ highEndBlurryRecognition: false })],
  });

  // Set the progress bar to be in an indeterminate state
  view.setProgressBarPercentage(null);
  view.setProgressBarMessage("Accessing Camera...");

  // Create the data capture context.
  const context: SDCCore.DataCaptureContext = await SDCCore.DataCaptureContext.create();

  // To visualize the ongoing barcode capturing process on screen, set up a data capture view that renders the
  // camera preview. The view must be connected to the data capture context.
  await view.setContext(context);

  // Try to use the world-facing (back) camera and set it as the frame source of the context. The camera is off by
  // default and must be turned on to start streaming frames to the data capture context for recognition.
  const camera: SDCCore.Camera = SDCCore.Camera.default;
  const cameraSettings = SDCBarcode.BarcodeTracking.recommendedCameraSettings;
  await camera.applySettings(cameraSettings);
  await context.setFrameSource(camera);

  // The barcode tracking process is configured through barcode tracking settings,
  // they are then applied to the barcode tracking instance that manages barcode recognition.
  // TODO: temporary, the final variation should be the one using scenario A
  // const settings: SDCBarcode.BarcodeTrackingSettings = new SDCBarcode.BarcodeTrackingSettings();
  const settings: SDCBarcode.BarcodeTrackingSettings = SDCBarcode.BarcodeTrackingSettings.forScenario(
    SDCBarcode.BarcodeTrackingScenario.A
  );

  // The settings instance initially has all types of barcodes (symbologies) disabled. For the purpose of this
  // sample we enable a very generous set of symbologies. In your own app ensure that you only enable the
  // symbologies that your app requires as every additional enabled symbology has an impact on processing times.
  settings.enableSymbologies([
    SDCBarcode.Symbology.EAN13UPCA,
    SDCBarcode.Symbology.EAN8,
    SDCBarcode.Symbology.UPCE,
    SDCBarcode.Symbology.QR,
    SDCBarcode.Symbology.DataMatrix,
    SDCBarcode.Symbology.Code39,
    SDCBarcode.Symbology.Code128,
    SDCBarcode.Symbology.InterleavedTwoOfFive,
  ]);

  // Some linear/1D barcode symbologies allow you to encode variable-length data. By default, the Scandit
  // Data Capture SDK only scans barcodes in a certain length range. If your application requires scanning of one
  // of these symbologies, and the length is falling outside the default range, you may need to adjust the "active
  // symbol counts" for this symbology. This is shown in the following few lines of code for one of the
  // variable-length symbologies.
  const symbologySettings: SDCBarcode.SymbologySettings = settings.settingsForSymbology(SDCBarcode.Symbology.Code39);
  symbologySettings.activeSymbolCounts = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

  // Create a new barcode tracking mode with the settings from above.
  const barcodeTracking = await SDCBarcode.BarcodeTracking.forContext(context, settings);
  // Disable the barcode tracking mode until the camera is accessed.
  await barcodeTracking.setEnabled(true);

  // Register a listener to get updates about tracked barcodes.
  barcodeTracking.addListener({
    didUpdateSession: (barcodeTrackingMode: SDCBarcode.BarcodeTracking, session: SDCBarcode.BarcodeTrackingSession) => {
      const trackedBarcodes: SDCBarcode.TrackedBarcode[] = Object.values(session.trackedBarcodes);
      const addedTrackedBarcodes: SDCBarcode.TrackedBarcode[] = Object.values(session.addedTrackedBarcodes);
      const removedTrackedBarcodes: string[] = Object.values(session.removedTrackedBarcodes);
      const updatedTrackedBarcodes: SDCBarcode.TrackedBarcode[] = Object.values(session.updatedTrackedBarcodes);

      const barcodeResultContainer = document.querySelector("#result-text")!;
      removeAllChildNodes(barcodeResultContainer);
      const fragment = document.createDocumentFragment();
      for (const trackedBarcode of trackedBarcodes) {
        const { barcode, identifier } = trackedBarcode;
        const symbology: SDCBarcode.SymbologyDescription = new SDCBarcode.SymbologyDescription(barcode.symbology);
        const li = document.createElement("li");
        li.id = `${identifier}`;
        li.textContent = `${barcode.data ?? "???"} (${symbology.readableName})`;
        fragment.append(li);
      }
      barcodeResultContainer.append(fragment);

      if (addedTrackedBarcodes.length > 0) {
        console.log("Added tracked barcodes:", addedTrackedBarcodes);
      }
      if (removedTrackedBarcodes.length > 0) {
        console.log("Removed tracked barcodes:", removedTrackedBarcodes);
      }
      if (updatedTrackedBarcodes.length > 0) {
        console.log("Updated tracked barcodes:", updatedTrackedBarcodes);
      }
    },
  });

  // Add a control to be able to switch cameras.
  view.addControl(new SDCCore.CameraSwitchControl());

  // Add a barcode tracking overlay to the data capture view to render the location of tracked barcodes on top of
  // the video preview. This is optional, but recommended for better visual feedback.
  await SDCBarcode.BarcodeTrackingBasicOverlay.withBarcodeTrackingForViewWithStyle(
    barcodeTracking,
    view,
    SDCBarcode.BarcodeTrackingBasicOverlayStyle.Frame
  );

  // Switch the camera on to start streaming frames.
  // The camera is started asynchronously and will take some time to completely turn on.
  await camera.switchToDesiredState(SDCCore.FrameSourceState.On);
  await barcodeTracking.setEnabled(true);
  view.hideProgressBar();
}

run().catch((error: unknown) => {
  console.error(error);
  alert(JSON.stringify(error, null, 2));
});