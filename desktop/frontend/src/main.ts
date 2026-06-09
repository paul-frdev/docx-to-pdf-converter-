import './style.css';
import './app.css';

import { ConvertFile, SelectFile, OpenFileLocation } from '../wailsjs/go/main/App';
import { EventsOn, OnFileDrop } from '../wailsjs/runtime/runtime';
import { main } from '../wailsjs/go/models';

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

/**
 * Transitions UI states based on active conversions
 */
function showState(state: 'idle' | 'converting' | 'success' | 'error') {
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
  progressBarFill.style.width = '0%';
  progressPercent.innerText = '0%';
  progressStage.innerText = 'Initializing...';
  progressMessage.innerText = 'Preparing document...';
}

/**
 * Triggers conversion process via Go App binding
 */
async function handleConversion(filePath: string) {
  if (!filePath) return;
  lastSelectedFilePath = filePath;

  const engine = engineSelect.value;
  const preserveMetadata = metadataToggle.checked;

  const config = new main.AppConfigMetadata({
    engine,
    preserveMetadata
  });

  try {
    const result = await ConvertFile(filePath, config);
    if (result.success) {
      currentOutputPath = result.outputPath;
      successDetail.innerHTML = `Converted successfully in <strong>${(result.durationMs / 1000).toFixed(2)}s</strong>.<br/>Saved to: <span style="font-family: monospace; font-size: 0.8rem; word-break: break-all;">${result.outputPath}</span>`;
      showState('success');
    } else {
      if (result.errorMessage === 'USER_CANCELLED') {
        showState('idle');
      } else {
        errorDetail.innerText = result.errorMessage || 'Unknown conversion error occurred.';
        showState('error');
      }
    }
  } catch (err: any) {
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

EventsOn('dialog_confirmed', () => {
  resetProgress();
  showState('converting');
});

EventsOn('conversion_progress', (data: ConversionProgress) => {
  if (!data) return;
  
  const stage = data.stage.toUpperCase();

  // Handle indeterminate loader state
  if (stage === 'CONVERTING') {
    progressBarFill.classList.add('indeterminate');
  } else {
    progressBarFill.classList.remove('indeterminate');
  }
  
  // Update progress bar width and text
  if (stage === 'COMPLETED') {
    progressBarFill.style.width = '100%';
    progressPercent.innerText = '100%';
  } else {
    const percentStr = `${Math.round(data.percentage)}%`;
    progressBarFill.style.width = percentStr;
    progressPercent.innerText = percentStr;
  }
  
  // Set stage title
  progressStage.innerText = data.stage;
  
  // Setup detailed progress message
  switch (stage) {
    case 'PARSING':
      progressMessage.innerText = 'Extracting document layout and text structures...';
      break;
    case 'CONVERTING':
      progressMessage.innerText = 'Generating PDF output stream...';
      break;
    case 'COMPLETED':
      progressMessage.innerText = 'Finalizing file stream write...';
      break;
    default:
      progressMessage.innerText = `Running stage: ${data.stage}...`;
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
