import './style.css';
import './app.css';

import { SelectFile, OpenFileLocation } from '../wailsjs/go/main/App';
import { EventsOn, OnFileDrop } from '../wailsjs/runtime/runtime';
import { main } from '../wailsjs/go/models';

type DesktopConversionResult = main.DesktopConversionResult;

declare global {
  interface Window {
    go: {
      main: {
        App: {
          ConvertFile: (sourcePath: string, config: main.AppConfigMetadata) => Promise<void>;
        };
      };
    };
  }
}

// Interface for progress events
interface ConversionProgress {
  stage: string;
  percentage: number;
}

// Initial UI HTML Layout
const appElement = document.querySelector('#app')!;
appElement.innerHTML = `
  <div class="app-container">
    <header>
      <h1>DOCX to PDF Converter</h1>
      <p>Offline, secure, high-fidelity desktop converter</p>
    </header>



    <!-- Drag & Drop Zone -->
    <div class="drop-zone" id="drop-zone">
      <div class="drop-zone-icon">📥</div>
      <h3>Drag & Drop your .docx file here</h3>
      <p>Supports files up to 25MB</p>
      <button class="file-select-btn" id="file-select-btn">Select File</button>
    </div>

    <!-- Progress Panel -->
    <div class="progress-panel hidden" id="progress-panel">
      <div class="progress-header">
        <span class="progress-stage" id="progress-stage">Initializing...</span>
      </div>
      <div class="infinite-spinner"></div>
      <div class="progress-message" id="progress-message">Waiting to start conversion...</div>
    </div>

    <!-- Success Panel -->
    <div class="result-panel success hidden" id="success-panel">
      <div class="result-icon">✓</div>
      <h3 class="result-title">Conversion Successful!</h3>
      <p class="result-detail" id="success-detail">Your PDF has been saved successfully.</p>
      <div class="btn-group">
        <button class="btn btn-success" id="open-folder-btn">Open PDF Location</button>
        <button class="btn btn-secondary" id="convert-more-success-btn">Convert Another</button>
      </div>
    </div>

    <!-- Error Panel -->
    <div class="result-panel error hidden" id="error-panel">
      <div class="result-icon">✗</div>
      <h3 class="result-title">Conversion Failed</h3>
      <p class="result-detail" id="error-detail">An error occurred during conversion.</p>
      <div class="btn-group">
        <button class="btn btn-primary" id="retry-btn">Try Again</button>
        <button class="btn btn-secondary" id="convert-more-error-btn">Cancel</button>
      </div>
    </div>
  </div>
`;

// Retrieve DOM references
const dropZone = document.getElementById('drop-zone') as HTMLDivElement;
const fileSelectBtn = document.getElementById('file-select-btn') as HTMLButtonElement;


const progressPanel = document.getElementById('progress-panel') as HTMLDivElement;
const progressStage = document.getElementById('progress-stage') as HTMLSpanElement;
const progressMessage = document.getElementById('progress-message') as HTMLDivElement;

const successPanel = document.getElementById('success-panel') as HTMLDivElement;
const successDetail = document.getElementById('success-detail') as HTMLParagraphElement;
const openFolderBtn = document.getElementById('open-folder-btn') as HTMLButtonElement;
const convertMoreSuccessBtn = document.getElementById('convert-more-success-btn') as HTMLButtonElement;

const errorPanel = document.getElementById('error-panel') as HTMLDivElement;
const errorDetail = document.getElementById('error-detail') as HTMLParagraphElement;
const retryBtn = document.getElementById('retry-btn') as HTMLButtonElement;
const convertMoreErrorBtn = document.getElementById('convert-more-error-btn') as HTMLButtonElement;

window.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (dropZone) dropZone.classList.add('dragging-active');
}, false);

window.addEventListener('dragleave', (e) => {
    e.preventDefault();
    // If mouse leaves the application window boundaries, clear layout highlights
    if (e.clientX === 0 && e.clientY === 0 && dropZone) {
        dropZone.classList.remove('dragging-active');
    }
}, false);





// Application State
let lastSelectedFilePath = '';
let lastGeneratedPdfPath = '';
let successTimeoutId: any = null;

/**
 * Transitions UI states based on active conversions
 */
function showState(state: 'idle' | 'converting' | 'success' | 'error') {
  if (state !== 'success' && successTimeoutId) {
    clearTimeout(successTimeoutId);
    successTimeoutId = null;
  }
  // Hide all dynamic panels by default
  dropZone.classList.add('hidden');
  progressPanel.classList.add('hidden');
  successPanel.classList.add('hidden');
  errorPanel.classList.add('hidden');

  switch (state) {
    case 'idle':
      dropZone.classList.remove('hidden');
      break;
    case 'converting':
      progressPanel.classList.remove('hidden');
      break;
    case 'success':
      successPanel.classList.remove('hidden');
      break;
    case 'error':
      errorPanel.classList.remove('hidden');
      break;
  }
}

/**
 * Reset progress indicators to baseline values
 */
function resetProgress() {
  if (successTimeoutId) {
    clearTimeout(successTimeoutId);
    successTimeoutId = null;
  }
  if (progressStage) {
    progressStage.innerText = 'Initializing...';
  }
  if (progressMessage) {
    progressMessage.innerText = 'Preparing document...';
  }
}

/**
 * Triggers conversion process via Go App binding
 */
async function handleConversion(sourcePath: string) {
  if (!sourcePath) return;
  lastSelectedFilePath = sourcePath;

  const dropZoneSub = dropZone?.querySelector('p');
  if (fileSelectBtn) {
    fileSelectBtn.innerText = "Opening Save Dialog... Please confirm destination.";
  }
  if (dropZoneSub) {
    dropZoneSub.innerText = "Opening Save Dialog... Please confirm destination.";
  }

  const config = new main.AppConfigMetadata({
    engine: "office",
    preserveMetadata: true
  });

  showState('converting');
  resetProgress();

  try {
    // ConvertFile runs completely asynchronously and returns void
    await window.go.main.App.ConvertFile(sourcePath, config);
  } catch (err: any) {
    if (fileSelectBtn) {
      fileSelectBtn.innerText = "Select File";
    }
    if (dropZoneSub) {
      dropZoneSub.innerText = "Supports files up to 25MB";
    }
    console.error("Infrastructure-level bridge error:", err);
    errorDetail.innerText = err?.message || err || 'An unexpected application bridge error occurred.';
    showState('error');
  }
}

// 1. Hook up file selection via Native OS dialogs
fileSelectBtn.addEventListener('click', async (e) => {
  e.stopPropagation(); // Prevent trigger dropzone click
  const path = await SelectFile();
  if (path) {
    handleConversion(path);
  }
});

// Also make entire drop zone clickable for selecting file
dropZone.addEventListener('click', async () => {
  const path = await SelectFile();
  if (path) {
    handleConversion(path);
  }
});

// 3. Register Wails Native File Drop Interceptor
OnFileDrop((_x: number, _y: number, paths: string[]) => {
  // Instantly clean up visual focus states once the OS registers the dropped payload
  if (dropZone) dropZone.classList.remove('dragging-active');

  if (paths && paths.length > 0) {
    const cleanAbsolutePath = paths[0]; // Wails native guarantees unencoded true absolute OS path
    const isDocx = cleanAbsolutePath.toLowerCase().endsWith('.docx');
    
    if (isDocx) {
      console.log("[RUNTIME] Safe Wails Native Drop Path Resolution:", cleanAbsolutePath);
      // Route the absolute locator string directly into the background asynchronous Goroutine pipeline
      handleConversion(cleanAbsolutePath);
    }
  }
}, true);



EventsOn("conversion_result", (result: DesktopConversionResult) => {
  const dropZoneSub = dropZone?.querySelector('p');
  if (fileSelectBtn) {
    fileSelectBtn.innerText = "Select File";
  }
  if (dropZoneSub) {
    dropZoneSub.innerText = "Supports files up to 25MB";
  }

  if (result && result.success) {
    if (progressMessage) {
      progressMessage.textContent = "Conversion Complete!";
    }

    lastGeneratedPdfPath = result.outputPath;
    if (successDetail) {
      successDetail.innerHTML = `Converted successfully in <strong>${(result.durationMs / 1000).toFixed(2)}s</strong>.<br/>Saved to: <span style="font-family: monospace; font-size: 0.8rem; word-break: break-all;">${result.outputPath}</span>`;
    }
    
    if (successTimeoutId) {
      clearTimeout(successTimeoutId);
    }
    successTimeoutId = setTimeout(() => {
      showState('success');
    }, 300);
  } else {
    const errorMsg = result?.errorMessage || 'Unknown conversion error occurred.';
    if (errorMsg === 'USER_CANCELLED') {
      showState('idle');
    } else {
      if (errorDetail) {
        errorDetail.textContent = errorMsg;
      }
      showState('error');
    }
  }
});

EventsOn('conversion_progress', (data: ConversionProgress) => {
  if (!data) return;
  
  const stage = data.stage ? data.stage.toUpperCase() : '';

  if (progressStage) {
    progressStage.innerText = data.stage || '';
  }

  if (stage === 'PARSING') {
    showState('converting');
    if (progressMessage) {
      progressMessage.innerText = 'Reading document file structures...';
    }
  } else if (stage === 'CONVERTING') {
    if (progressMessage) {
      progressMessage.innerText = 'Converting document layouts and embedding fonts... Please wait.';
    }
  } else if (stage === 'COMPLETED') {
    if (progressMessage) {
      progressMessage.innerText = 'Conversion Complete!';
    }
  } else {
    if (progressMessage) {
      progressMessage.innerText = `Running stage: ${data.stage}...`;
    }
  }
});

// 5. Button Actions
if (openFolderBtn) {
  openFolderBtn.addEventListener('click', async () => {
    if (lastGeneratedPdfPath) {
      await OpenFileLocation(lastGeneratedPdfPath);
    }
  });
}

if (convertMoreSuccessBtn) {
  convertMoreSuccessBtn.addEventListener('click', () => {
    showState('idle');
  });
}

if (convertMoreErrorBtn) {
  convertMoreErrorBtn.addEventListener('click', () => {
    showState('idle');
  });
}

if (retryBtn) {
  retryBtn.addEventListener('click', () => {
    if (lastSelectedFilePath) {
      handleConversion(lastSelectedFilePath);
    } else {
      showState('idle');
    }
  });
}
