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
          ConvertFile: (sourcePath: string, config: main.AppConfigMetadata) => Promise<DesktopConversionResult>;
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

    <!-- Config Section -->
    <div class="config-section" id="config-section">
      <div class="config-item">
        <span class="config-label">Conversion Engine</span>
        <div class="select-wrapper">
          <select id="engine-select" class="custom-select" disabled>
            <option value="office">LibreOffice Engine</option>
            <option value="native">Native JS Engine</option>
          </select>
        </div>
      </div>
      <div class="config-item">
        <span class="config-label">Preserve Metadata</span>
        <div class="toggle-container">
          <span>Enable high fidelity</span>
          <label class="switch">
            <input type="checkbox" id="metadata-toggle" checked disabled>
            <span class="slider"></span>
          </label>
        </div>
      </div>
    </div>

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
        <span class="progress-percent" id="progress-percent">0%</span>
      </div>
      <div class="progress-bar-bg">
        <div class="progress-bar-fill" id="progress-bar-fill"></div>
      </div>
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
const configSection = document.getElementById('config-section') as HTMLDivElement;

const progressPanel = document.getElementById('progress-panel') as HTMLDivElement;
const progressStage = document.getElementById('progress-stage') as HTMLSpanElement;
const progressPercent = document.getElementById('progress-percent') as HTMLSpanElement;
const progressBarFill = document.getElementById('progress-bar-fill') as HTMLDivElement;
const progressMessage = document.getElementById('progress-message') as HTMLDivElement;

const successPanel = document.getElementById('success-panel') as HTMLDivElement;
const successDetail = document.getElementById('success-detail') as HTMLParagraphElement;
const openFolderBtn = document.getElementById('open-folder-btn') as HTMLButtonElement;
const convertMoreSuccessBtn = document.getElementById('convert-more-success-btn') as HTMLButtonElement;

const errorPanel = document.getElementById('error-panel') as HTMLDivElement;
const errorDetail = document.getElementById('error-detail') as HTMLParagraphElement;
const retryBtn = document.getElementById('retry-btn') as HTMLButtonElement;
const convertMoreErrorBtn = document.getElementById('convert-more-error-btn') as HTMLButtonElement;

const engineSelect = document.getElementById('engine-select') as HTMLSelectElement;
const metadataToggle = document.getElementById('metadata-toggle') as HTMLInputElement;

// Application State
let lastSelectedFilePath = '';
let currentOutputPath = '';
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
  configSection.classList.add('hidden');
  progressPanel.classList.add('hidden');
  successPanel.classList.add('hidden');
  errorPanel.classList.add('hidden');

  switch (state) {
    case 'idle':
      dropZone.classList.remove('hidden');
      configSection.classList.remove('hidden');
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
  if (progressBarFill) {
    progressBarFill.classList.remove('indeterminate');
    progressBarFill.style.width = '0%';
  }
  if (progressPercent) {
    progressPercent.style.display = 'none';
    progressPercent.textContent = '';
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

  const engine = engineSelect.value;
  const preserveMetadata = metadataToggle.checked;

  const config = new main.AppConfigMetadata({
    engine,
    preserveMetadata
  });

  try {
    const initResult = await window.go.main.App.ConvertFile(sourcePath, config);

    if (initResult.success) {
      showState('converting');
      resetProgress();
    }

    if (fileSelectBtn) {
      fileSelectBtn.innerText = "Select File";
    }
    if (dropZoneSub) {
      dropZoneSub.innerText = "Supports files up to 25MB";
    }

    if (!initResult.success) {
      if (initResult.errorMessage === 'USER_CANCELLED') {
        showState('idle');
      } else {
        errorDetail.innerText = initResult.errorMessage || 'Unknown conversion error occurred.';
        showState('error');
      }
    }
  } catch (err: any) {
    if (fileSelectBtn) {
      fileSelectBtn.innerText = "Select File";
    }
    if (dropZoneSub) {
      dropZoneSub.innerText = "Supports files up to 25MB";
    }

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

// 2. Drag over hover state visual feedback
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  // Actual path extraction is handled globally by Wails OnFileDrop callback
});

// 3. Register Wails Native File Drop Interceptor
OnFileDrop((_x, _y, paths) => {
  if (paths && paths.length > 0) {
    const targetFile = paths[0];
    if (targetFile.toLowerCase().endsWith('.docx')) {
      handleConversion(targetFile);
    } else {
      errorDetail.innerText = 'Invalid file type. Please drag and drop a valid .docx file.';
      showState('error');
    }
  }
}, true);

// 4. Bind Real-time Go Backend events
EventsOn('service_handshake', (status: boolean) => {
  if (status) {
    engineSelect.disabled = false;
    metadataToggle.disabled = false;
  }
});

EventsOn("conversion_complete", (result: DesktopConversionResult) => {
  const dropZoneSub = dropZone?.querySelector('p');
  if (fileSelectBtn) {
    fileSelectBtn.innerText = "Select File";
  }
  if (dropZoneSub) {
    dropZoneSub.innerText = "Supports files up to 25MB";
  }

  if (result && result.success) {
    if (progressBarFill) {
      progressBarFill.classList.remove('indeterminate');
      progressBarFill.style.width = "100%";
    }
    if (progressPercent) {
      progressPercent.style.display = '';
      progressPercent.textContent = "100%";
    }
    if (progressMessage) {
      progressMessage.textContent = "Conversion Complete!";
    }

    currentOutputPath = result.outputPath;
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
    if (errorDetail) {
      errorDetail.textContent = errorMsg;
    }
    showState('error');
  }
});

EventsOn('conversion_progress', (data: ConversionProgress) => {
  if (!data) return;
  
  const stage = data.stage ? data.stage.toUpperCase() : '';

  if (stage === 'PARSING') {
    if (progressBarFill) {
      progressBarFill.classList.remove('indeterminate');
      const percentStr = `${Math.round(data.percentage)}%`;
      progressBarFill.style.width = percentStr;
    }
    if (progressPercent) {
      progressPercent.style.display = '';
      progressPercent.innerText = `${Math.round(data.percentage)}%`;
    }
    if (progressStage) {
      progressStage.innerText = data.stage;
    }
    if (progressMessage) {
      progressMessage.innerText = 'Extracting document layout and text structures...';
    }
  } else if (stage === 'CONVERTING') {
    if (progressBarFill) {
      progressBarFill.style.width = "100%";
      progressBarFill.classList.add('indeterminate');
    }
    if (progressPercent) {
      progressPercent.style.display = '';
      progressPercent.textContent = "Processing...";
    }
    if (progressStage) {
      progressStage.innerText = data.stage;
    }
    if (progressMessage) {
      progressMessage.innerText = 'Converting document layouts and embedding fonts...';
    }
  } else if (stage === 'COMPLETED') {
    if (progressBarFill) {
      progressBarFill.classList.remove('indeterminate');
      progressBarFill.style.width = "100%";
    }
    if (progressPercent) {
      progressPercent.style.display = '';
      progressPercent.textContent = "100%";
    }
    if (progressStage) {
      progressStage.innerText = data.stage;
    }
    if (progressMessage) {
      progressMessage.innerText = 'Conversion Complete!';
    }
  } else {
    if (progressBarFill) {
      progressBarFill.classList.remove('indeterminate');
      const percentStr = `${Math.round(data.percentage)}%`;
      progressBarFill.style.width = percentStr;
    }
    if (progressPercent) {
      progressPercent.style.display = '';
      progressPercent.innerText = `${Math.round(data.percentage)}%`;
    }
    if (progressStage) {
      progressStage.innerText = data.stage;
    }
    if (progressMessage) {
      progressMessage.innerText = `Running stage: ${data.stage}...`;
    }
  }
});

// 5. Button Actions
openFolderBtn.addEventListener('click', () => {
  if (currentOutputPath) {
    OpenFileLocation(currentOutputPath);
  }
});

convertMoreSuccessBtn.addEventListener('click', () => {
  showState('idle');
});

convertMoreErrorBtn.addEventListener('click', () => {
  showState('idle');
});

retryBtn.addEventListener('click', () => {
  if (lastSelectedFilePath) {
    handleConversion(lastSelectedFilePath);
  } else {
    showState('idle');
  }
});
