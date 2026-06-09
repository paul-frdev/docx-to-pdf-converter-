package main

import (
	"bufio"
	"bytes"
	"context"
	"flag"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	goRuntime "runtime"
	"strings"
	"time"

	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx context.Context
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	if flag.Lookup("test.v") == nil {
		go func() {
			time.Sleep(100 * time.Millisecond)
			wailsruntime.EventsEmit(ctx, "service_handshake", true)
		}()
	}
}

type AppConfigMetadata struct {
	PreserveMetadata bool   `json:"preserveMetadata"`
	Engine           string `json:"engine"`
}

type ConversionProgress struct {
	Stage      string  `json:"stage"`
	Percentage float64 `json:"percentage"`
}

type DesktopConversionResult struct {
	Success      bool   `json:"success"`
	OutputPath   string `json:"outputPath"`
	ErrorMessage string `json:"errorMessage"`
	DurationMs   int64  `json:"durationMs"`
}

// ConvertFile handles the desktop conversion using native OS layout engines
func (a *App) ConvertFile(sourcePath string, config AppConfigMetadata) *DesktopConversionResult {
	startTime := time.Now()

	// 1. File validation: Size and magic signature check
	stat, err := os.Stat(sourcePath)
	if err != nil {
		return &DesktopConversionResult{
			Success:      false,
			OutputPath:   "",
			ErrorMessage: "Failed to stat source file: " + err.Error(),
			DurationMs:   time.Since(startTime).Milliseconds(),
		}
	}

	const maxFileSize = 52428800 // 50 * 1024 * 1024
	if stat.Size() > maxFileSize {
		return &DesktopConversionResult{
			Success:      false,
			OutputPath:   "",
			ErrorMessage: "FILE_TOO_LARGE: File size exceeds the maximum allowable limit of 50MB",
			DurationMs:   time.Since(startTime).Milliseconds(),
		}
	}

	file, err := os.Open(sourcePath)
	if err != nil {
		return &DesktopConversionResult{
			Success:      false,
			OutputPath:   "",
			ErrorMessage: "Failed to open source file: " + err.Error(),
			DurationMs:   time.Since(startTime).Milliseconds(),
		}
	}
	defer file.Close()

	signature := make([]byte, 4)
	if _, err := io.ReadFull(file, signature); err != nil {
		return &DesktopConversionResult{
			Success:      false,
			OutputPath:   "",
			ErrorMessage: "INVALID_DOCX_SIGNATURE: The provided file is not a valid OOXML document",
			DurationMs:   time.Since(startTime).Milliseconds(),
		}
	}

	expectedSignature := []byte{0x50, 0x4B, 0x03, 0x04}
	if !bytes.Equal(signature, expectedSignature) {
		return &DesktopConversionResult{
			Success:      false,
			OutputPath:   "",
			ErrorMessage: "INVALID_DOCX_SIGNATURE: The provided file is not a valid OOXML document",
			DurationMs:   time.Since(startTime).Milliseconds(),
		}
	}

	// 2. Prompt user to choose where to save the final PDF
	baseName := filepath.Base(sourcePath)
	ext := filepath.Ext(baseName)
	defaultPdfName := baseName[:len(baseName)-len(ext)] + ".pdf"

	savePath, err := wailsruntime.SaveFileDialog(a.ctx, wailsruntime.SaveDialogOptions{
		Title:            "Save Converted PDF",
		DefaultDirectory: filepath.Dir(sourcePath),
		DefaultFilename:  defaultPdfName,
		Filters: []wailsruntime.FileFilter{
			{
				DisplayName: "PDF Files (*.pdf)",
				Pattern:     "*.pdf",
			},
		},
	})

	if err != nil {
		return &DesktopConversionResult{
			Success:      false,
			OutputPath:   "",
			ErrorMessage: "Failed to open save dialog: " + err.Error(),
			DurationMs:   time.Since(startTime).Milliseconds(),
		}
	}

	if savePath == "" {
		return &DesktopConversionResult{
			Success:      false,
			OutputPath:   "",
			ErrorMessage: "USER_CANCELLED",
			DurationMs:   time.Since(startTime).Milliseconds(),
		}
	}

	// Spin off background goroutine to execute conversion
	go a.executeBackgroundConversion(sourcePath, savePath, config)

	return &DesktopConversionResult{
		Success:      true,
		OutputPath:   "",
		ErrorMessage: "CONVERSION_STARTED",
		DurationMs:   time.Since(startTime).Milliseconds(),
	}
}

// executeBackgroundConversion executes conversion in a background goroutine
func (a *App) executeBackgroundConversion(sourcePath string, savePath string, config AppConfigMetadata) {
	startTime := time.Now()

	// OS-level conversion switch
	switch goos := goRuntime.GOOS; goos {
	case "darwin":
		sofficePath, err := getEmbeddedOfficePath()
		if err != nil {
			a.emitConversionComplete(&DesktopConversionResult{
				Success:      false,
				OutputPath:   "",
				ErrorMessage: err.Error(),
				DurationMs:   time.Since(startTime).Milliseconds(),
			})
			return
		}
		res := a.convertWithLibreOffice(sofficePath, sourcePath, savePath, startTime)
		if !res.Success {
			a.emitConversionComplete(res)
			return
		}

	case "windows":
		sofficePath, err := getEmbeddedOfficePath()
		if err == nil {
			res := a.convertWithLibreOffice(sofficePath, sourcePath, savePath, startTime)
			if res.Success {
				break
			}
			// If LibreOffice conversion failed, fall back to Word COM automation
		}

		// Fallback to Windows COM Automation via powershell script
		psCmd := fmt.Sprintf(`$word = New-Object -ComObject Word.Application; $word.Visible = $false; $doc = $word.Documents.Open('%s'); $doc.SaveAs([ref] '%s', [ref] 17); $doc.Close(); $word.Quit();`, sourcePath, savePath)
		cmd := exec.Command("powershell", "-NoProfile", "-NonInteractive", "-Command", psCmd)
		output, err := cmd.CombinedOutput()
		if err != nil {
			a.emitConversionComplete(&DesktopConversionResult{
				Success:      false,
				OutputPath:   "",
				ErrorMessage: fmt.Sprintf("Windows Word COM Automation failed: %s. Output: %s", err.Error(), string(output)),
				DurationMs:   time.Since(startTime).Milliseconds(),
			})
			return
		}

	default:
		a.emitConversionComplete(&DesktopConversionResult{
			Success:      false,
			OutputPath:   "",
			ErrorMessage: "Unsupported operating system engine: " + goos,
			DurationMs:   time.Since(startTime).Milliseconds(),
		})
		return
	}

	duration := time.Since(startTime).Milliseconds()
	a.emitConversionComplete(&DesktopConversionResult{
		Success:      true,
		OutputPath:   savePath,
		ErrorMessage: "",
		DurationMs:   duration,
	})
}

// emitConversionComplete emits the final conversion completion event to the Wails frontend
func (a *App) emitConversionComplete(result *DesktopConversionResult) {
	if a.ctx == nil {
		return
	}
	if flag.Lookup("test.v") != nil {
		return
	}
	wailsruntime.EventsEmit(a.ctx, "conversion_complete", result)
}

// convertWithLibreOffice executes LibreOffice CLI to convert a DOCX file to PDF
func (a *App) convertWithLibreOffice(sofficePath string, sourcePath string, savePath string, startTime time.Time) *DesktopConversionResult {
	// Create a temp directory for conversion to bypass write/path isolation issues
	tempDir, err := os.MkdirTemp("", "docx-to-pdf")
	if err != nil {
		return &DesktopConversionResult{
			Success:      false,
			OutputPath:   "",
			ErrorMessage: "Failed to create temporary directory: " + err.Error(),
			DurationMs:   time.Since(startTime).Milliseconds(),
		}
	}
	defer os.RemoveAll(tempDir)

	tempInputPath := filepath.Join(tempDir, "input.docx")
	inputData, err := os.ReadFile(sourcePath)
	if err != nil {
		return &DesktopConversionResult{
			Success:      false,
			OutputPath:   "",
			ErrorMessage: "Failed to read source document: " + err.Error(),
			DurationMs:   time.Since(startTime).Milliseconds(),
		}
	}
	err = os.WriteFile(tempInputPath, inputData, 0644)
	if err != nil {
		return &DesktopConversionResult{
			Success:      false,
			OutputPath:   "",
			ErrorMessage: "Failed to prepare document for conversion: " + err.Error(),
			DurationMs:   time.Since(startTime).Milliseconds(),
		}
	}

	// Setup isolated user installation folder in temp directory to prevent locking issues
	userInstDir := filepath.Join(tempDir, "profile")
	slashPath := filepath.ToSlash(userInstDir)
	if goRuntime.GOOS == "windows" {
		if len(slashPath) > 0 && slashPath[0] != '/' {
			slashPath = "/" + slashPath
		}
	}
	userInstFlag := "-env:UserInstallation=file://" + slashPath

	absTempDir, err := filepath.Abs(tempDir)
	if err != nil {
		return &DesktopConversionResult{
			Success:      false,
			OutputPath:   "",
			ErrorMessage: "Failed to resolve absolute path of temporary directory: " + err.Error(),
			DurationMs:   time.Since(startTime).Milliseconds(),
		}
	}
	absTempInputPath, err := filepath.Abs(tempInputPath)
	if err != nil {
		return &DesktopConversionResult{
			Success:      false,
			OutputPath:   "",
			ErrorMessage: "Failed to resolve absolute path of source document: " + err.Error(),
			DurationMs:   time.Since(startTime).Milliseconds(),
		}
	}

	cmd := exec.Command(sofficePath,
		"--headless",
		"--invisible",
		"--nolockcheck",
		"--nodefault",
		"--nofirststartwizard",
		"--norestore",
		userInstFlag,
		"--writer",
		"--convert-to", "pdf:writer_pdf_Export",
		"--outdir", absTempDir,
		absTempInputPath,
	)
	cmd.Dir = filepath.Dir(sofficePath)
	stdoutPipe, err := cmd.StdoutPipe()
	if err != nil {
		return &DesktopConversionResult{
			Success:      false,
			OutputPath:   "",
			ErrorMessage: "Failed to create stdout pipe: " + err.Error(),
			DurationMs:   time.Since(startTime).Milliseconds(),
		}
	}

	var stderrBuf bytes.Buffer
	cmd.Stderr = &stderrBuf

	if err := cmd.Start(); err != nil {
		return &DesktopConversionResult{
			Success:      false,
			OutputPath:   "",
			ErrorMessage: "Failed to start LibreOffice: " + err.Error(),
			DurationMs:   time.Since(startTime).Milliseconds(),
		}
	}

	stdoutBufString := a.scanStdoutAndEmit(stdoutPipe)

	err = cmd.Wait()
	combinedOutput := stdoutBufString + stderrBuf.String()
	if err != nil {
		return &DesktopConversionResult{
			Success:      false,
			OutputPath:   "",
			ErrorMessage: fmt.Sprintf("LibreOffice conversion failed: %s. Output: %s", err.Error(), combinedOutput),
			DurationMs:   time.Since(startTime).Milliseconds(),
		}
	}

	tempPdfPath := filepath.Join(tempDir, "input.pdf")
	if _, err := os.Stat(tempPdfPath); os.IsNotExist(err) {
		return &DesktopConversionResult{
			Success:      false,
			OutputPath:   "",
			ErrorMessage: "LibreOffice did not generate output PDF file",
			DurationMs:   time.Since(startTime).Milliseconds(),
		}
	}

	pdfData, err := os.ReadFile(tempPdfPath)
	if err != nil {
		return &DesktopConversionResult{
			Success:      false,
			OutputPath:   "",
			ErrorMessage: "Failed to read converted PDF data: " + err.Error(),
			DurationMs:   time.Since(startTime).Milliseconds(),
		}
	}

	err = os.WriteFile(savePath, pdfData, 0644)
	if err != nil {
		return &DesktopConversionResult{
			Success:      false,
			OutputPath:   "",
			ErrorMessage: "Failed to save PDF to selected location: " + err.Error(),
			DurationMs:   time.Since(startTime).Milliseconds(),
		}
	}

	return &DesktopConversionResult{
		Success:      true,
		OutputPath:   savePath,
		ErrorMessage: "",
		DurationMs:   time.Since(startTime).Milliseconds(),
	}
}

// scanStdoutAndEmit reads lines from the execution pipe and emits Wails events
func (a *App) scanStdoutAndEmit(reader io.Reader) string {
	var stdoutBuf bytes.Buffer
	scanner := bufio.NewScanner(reader)
	for scanner.Scan() {
		line := scanner.Text()
		stdoutBuf.WriteString(line + "\n")

		if strings.Contains(line, "[STATUS]: PARSING") {
			a.emitProgress("PARSING", 33.3)
		} else if strings.Contains(line, "[STATUS]: CONVERTING") {
			a.emitProgress("CONVERTING", 66.6)
		} else if strings.Contains(line, "[STATUS]: COMPLETED") {
			a.emitProgress("COMPLETED", 100.0)
		}
	}
	return stdoutBuf.String()
}

// emitProgress safely emits progress events, skipping empty contexts or unit tests
func (a *App) emitProgress(stage string, percentage float64) {
	if a.ctx == nil {
		return
	}
	if flag.Lookup("test.v") != nil {
		return
	}
	wailsruntime.EventsEmit(a.ctx, "conversion_progress", ConversionProgress{Stage: stage, Percentage: percentage})
}

// getEmbeddedOfficePath resolves the path to the embedded or system LibreOffice binary
func getEmbeddedOfficePath() (string, error) {
	exePath, err := os.Executable()
	if err != nil {
		return "", err
	}
	exePath, err = filepath.EvalSymlinks(exePath)
	if err != nil {
		return "", err
	}
	exeDir := filepath.Dir(exePath)

	switch goRuntime.GOOS {
	case "darwin":
		// Check macOS app bundle resources
		embeddedPath := filepath.Clean(filepath.Join(exeDir, "..", "Resources", "libreoffice", "soffice"))
		if _, err := os.Stat(embeddedPath); err == nil {
			return embeddedPath, nil
		}
		// Fallback to standard system installation
		systemPath := "/Applications/LibreOffice.app/Contents/MacOS/soffice"
		if _, err := os.Stat(systemPath); err == nil {
			return systemPath, nil
		}
		return "", fmt.Errorf("embedded LibreOffice not found at %s and system LibreOffice not found at %s", embeddedPath, systemPath)

	case "windows":
		// Check Windows nested directory structure relative to the binary
		embeddedPath1 := filepath.Join(exeDir, "libreoffice", "program", "soffice.exe")
		if _, err := os.Stat(embeddedPath1); err == nil {
			return embeddedPath1, nil
		}
		embeddedPath2 := filepath.Join(exeDir, "libreoffice", "soffice.exe")
		if _, err := os.Stat(embeddedPath2); err == nil {
			return embeddedPath2, nil
		}

		// Fallback to standard Windows system installation
		programFiles := os.Getenv("ProgramFiles")
		if programFiles == "" {
			programFiles = "C:\\Program Files"
		}
		systemPath1 := filepath.Join(programFiles, "LibreOffice", "program", "soffice.exe")
		if _, err := os.Stat(systemPath1); err == nil {
			return systemPath1, nil
		}

		programFilesX86 := os.Getenv("ProgramFiles(x86)")
		if programFilesX86 == "" {
			programFilesX86 = "C:\\Program Files (x86)"
		}
		systemPath2 := filepath.Join(programFilesX86, "LibreOffice", "program", "soffice.exe")
		if _, err := os.Stat(systemPath2); err == nil {
			return systemPath2, nil
		}

		return "", fmt.Errorf("embedded LibreOffice not found at %s and system LibreOffice not found", embeddedPath1)

	default:
		return "", fmt.Errorf("unsupported platform: %s", goRuntime.GOOS)
	}
}

// OpenFileLocation opens the folder containing the file in Finder/Explorer
func (a *App) OpenFileLocation(outputPath string) {
	dir := filepath.Dir(outputPath)
	wailsruntime.BrowserOpenURL(a.ctx, dir)
}

// SelectFile opens a native file dialog to choose a DOCX file
func (a *App) SelectFile() string {
	path, err := wailsruntime.OpenFileDialog(a.ctx, wailsruntime.OpenDialogOptions{
		Title: "Select Word Document",
		Filters: []wailsruntime.FileFilter{
			{
				DisplayName: "Word Documents (*.docx)",
				Pattern:     "*.docx",
			},
		},
	})
	if err != nil {
		return ""
	}
	return path
}
