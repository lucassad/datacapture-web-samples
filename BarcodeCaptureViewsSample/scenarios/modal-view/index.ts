import * as SDCCore from "scandit-web-datacapture-core";
import * as SDCBarcode from "scandit-web-datacapture-barcode";
import type { LoadingStatusSubscriber, ProgressInfo } from "scandit-web-datacapture-core";

// Main DOM elements in the page.
const pageElements = {
  input: document.getElementById("input") as HTMLInputElement,
  button: document.getElementById("scan") as HTMLInputElement,
  modalContainer: document.getElementById("modal") as HTMLInputElement,
  modal: document.querySelector("#modal .modal-inner") as HTMLInputElement,
  backdrop: document.querySelector("#modal .backdrop")!,
  captureHost: document.getElementById("data-capture-view")!,
};

async function run(): Promise<void> {
  // Keep a reference to the context object.
  let context: SDCCore.DataCaptureContext;
  // Keep a reference to the barcode capture mode object.
  let barcodeCapture: SDCBarcode.BarcodeCapture;

  const updateUIWithProgress: LoadingStatusSubscriber = (info: ProgressInfo) => {
    if (info.percentage != null) {
      pageElements.input.value = `Loading... ${info.percentage}%`;
    }
    if (info.percentage === 100) {
      pageElements.input.value = ``;
    }
  };

  async function loadAndPrepareLibrary(): Promise<void> {
    // Subscribe to the loading status and update UI accordingly
    SDCCore.loadingStatus.subscribe(updateUIWithProgress);

    // There is a Scandit sample license key set below here.
    // This license key is enabled for sample evaluation only.
    // If you want to build your own application, get your license key by signing up for a trial at https://ssl.scandit.com/dashboard/sign-up?p=test
    // The passed parameter represents the location of the wasm file, which will be fetched asynchronously.
    // You must `await` the returned promise to be able to continue.
    await SDCCore.configure({
      licenseKey: "AWHjFzlFHa+fLq/kfS8GCBU/hT60NkQeVGQOWhhtRVcDZxJfsD0OY9NK0YErLuxTtTKLC1BLdrvDdsJ1dnxmcx9fDIeeaQlxawtkiq1pmEFxHOvYa3emcbAfOeiwbFPtQEWCWvdc95KoIFxAuDiYcfccdywzH2KONgwmnV9cEcX11FhIPLtX74RLua7VkOukFfNTOGExxhiCq96qZnzGgrgViuagpL0ekK6xv8K4bYt7lVkxloUMM6dFRSZ4aummJ2Q1uZNR78kSGCpCn/uJjaf/5lyNbYWpnxYvsYRPI7jOFYZykI0nIjhjt/ncukCEsz4BQLAh5hp1qocvQ2+dw3ADD8LJLXcnX7JaCOKV5cfHEHGSLR4moTxNtxPXdUNlM5w75iHZub5BsIfkJCknKrLn5oJ15k5Rx4/JnFj11tGLqtfRs+jdtXSGxAb86BxwPM1mEBO/Va1yV//CGku5UWR5MwspCf7pl8OUH7frkCtV4kDB6y5jusSMSIEGnKCLd2sWKE04mAURrpWt8pgsIB89xXPPTgPh1C+nAeMuuEN3dPYAJYrJKvy44w130JrUvxWLcTM1oFVWikC6CluLC7WGgRhZCew0eROnv9neITolB6Gmy04dlF0euA595dJcw2lLTwwxEydGp5gGIIDtofviho7JdHtPrMer/Ptz1/LOVeF55OY9eg8z1Lq2CkZf6cgWZBPa1uakuZzxWXZUprJMdTquhInmqP4ELLxGXhv+CXoT2n0p022+wyiWAXatmhvcK+n2uCWX30SL0Sri1qPmf6Ldtgqj2aFEMLM+LouJg6Ukv0PKUTXlgPW7L0vYrNGtPjvRlaR7Nwph",
      libraryLocation: new URL("../../library/engine/", document.baseURI).toString(),
      moduleLoaders: [SDCBarcode.barcodeCaptureLoader()],
    });

    // Unsubscribe to the loading status updates
    SDCCore.loadingStatus.unsubscribe(updateUIWithProgress);

    // Create the data capture context.
    context = await SDCCore.DataCaptureContext.create();

    // Try to use the world-facing (back) camera and set it as the frame source of the context. The camera is off by
    // default and must be turned on to start streaming frames to the data capture context for recognition.
    await context.setFrameSource(SDCCore.Camera.default);

    // The barcode capturing process is configured through barcode capture settings,
    // they are then applied to the barcode capture instance that manages barcode recognition.
    const settings: SDCBarcode.BarcodeCaptureSettings = new SDCBarcode.BarcodeCaptureSettings();

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

    // Create a new barcode capture mode with the settings from above.
    barcodeCapture = await SDCBarcode.BarcodeCapture.forContext(context, settings);
    // Disable the barcode capture mode until the camera is accessed.
    await barcodeCapture.setEnabled(false);

    // Register a listener to get informed whenever a new barcode got recognized.
    barcodeCapture.addListener({ didScan });

    // To visualize the ongoing barcode capturing process on screen, set up a data capture view that renders the
    // camera preview. The view must be connected to the data capture context.
    const view = await SDCCore.DataCaptureView.forContext(context);

    // Connect the data capture view to the HTML element.
    view.connectToElement(pageElements.captureHost);

    // Add a control to be able to switch cameras.
    view.addControl(new SDCCore.CameraSwitchControl());
  }

  const waitTransition = async (element: HTMLElement): Promise<void> =>
    new Promise<void>((resolve) => {
      element.addEventListener(
        "transitionend",
        () => {
          resolve();
        },
        { once: true }
      );
    });

  // Close the modal and switch off the camera.
  async function closeModal(): Promise<void> {
    pageElements.modalContainer.classList.remove("open");
    await waitTransition(pageElements.modal);
    await context.frameSource!.switchToDesiredState(SDCCore.FrameSourceState.Off);
    pageElements.button.disabled = false;
    pageElements.button.textContent = "Click to Scan";
  }

  async function openModal(): Promise<void> {
    pageElements.modalContainer.classList.add("open");

    await waitTransition(pageElements.modal);
  }

  // Open our modal and start the camera to scan a barcode.
  async function onOpenModal(): Promise<void> {
    pageElements.input.blur();
    // Start the camera. This can potentially fail, so we use try/catch.
    try {
      pageElements.button.textContent = "Loading...";
      pageElements.button.disabled = true;
      await context.frameSource!.switchToDesiredState(SDCCore.FrameSourceState.On);
      await openModal();
      await barcodeCapture.setEnabled(true);
    } catch (error: unknown) {
      const reason: string =
        typeof error === "object" && error != null && typeof error["toString"] === "function"
          ? error.toString()
          : "unknown error";
      alert(`Could not start camera: ${reason}`);
      pageElements.input.placeholder = reason;
      await closeModal();
    }
  }

  // When a scan happened, we populate the input and close the modal.
  async function didScan(
    barcodeCaptureMode: SDCBarcode.BarcodeCapture,
    session: SDCBarcode.BarcodeCaptureSession
  ): Promise<void> {
    await barcodeCapture.setEnabled(false);
    const barcode: SDCBarcode.Barcode = session.newlyRecognizedBarcodes[0];
    await closeModal();
    pageElements.input.value = barcode.data ?? "";
  }

  // Load the library as soon as possible. This will make the user experience faster.
  await loadAndPrepareLibrary();
  pageElements.button.disabled = false;
  pageElements.input.disabled = false;
  pageElements.input.placeholder = "Barcodes will appear here";

  // At this point the library was loaded, set up the UI elements (progressive enhancement).
  pageElements.button.addEventListener("click", onOpenModal);
  pageElements.backdrop.addEventListener("click", closeModal);
  pageElements.input.addEventListener("focus", () => {
    pageElements.input.setSelectionRange(0, pageElements.input.value.length);
  });
  document.addEventListener("keydown", async (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      await closeModal();
    }
  });
}

run().catch((error) => {
  console.error(error);
  alert(JSON.stringify(error, null, 2));
  pageElements.input.disabled = false;
  pageElements.input.placeholder = "Enter code manually";
});
