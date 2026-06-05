package main

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
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

// ConvertFile handles the desktop conversion simulation
func (a *App) ConvertFile(sourcePath string, config AppConfigMetadata) *DesktopConversionResult {
	startTime := time.Now()

	// 1. Prompt user to choose where to save the final PDF
	baseName := filepath.Base(sourcePath)
	ext := filepath.Ext(baseName)
	defaultPdfName := baseName[:len(baseName)-len(ext)] + ".pdf"

	savePath, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:            "Save Converted PDF",
		DefaultDirectory: filepath.Dir(sourcePath),
		DefaultFilename:  defaultPdfName,
		Filters: []runtime.FileFilter{
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
			ErrorMessage: "Save dialog cancelled by user",
			DurationMs:   time.Since(startTime).Milliseconds(),
		}
	}

	// 2. Simulate conversion progress stages
	// Stage 1: PARSING (33.3%)
	runtime.EventsEmit(a.ctx, "conversion_progress", ConversionProgress{
		Stage:      "PARSING",
		Percentage: 33.3,
	})
	time.Sleep(500 * time.Millisecond)

	// Stage 2: CONVERTING (66.6%)
	runtime.EventsEmit(a.ctx, "conversion_progress", ConversionProgress{
		Stage:      "CONVERTING",
		Percentage: 66.6,
	})
	time.Sleep(500 * time.Millisecond)

	// Stage 3: COMPLETED (100.0%)
	runtime.EventsEmit(a.ctx, "conversion_progress", ConversionProgress{
		Stage:      "COMPLETED",
		Percentage: 100.0,
	})
	time.Sleep(500 * time.Millisecond)

	// 3. Find the CLI script dynamically
	cliPaths := []string{
		"dist/infrastructure/adapters/native/cli.js",
		"../dist/infrastructure/adapters/native/cli.js",
		"/Users/admin/Desktop/docx-to-pdf-converter/dist/infrastructure/adapters/native/cli.js",
		"/Users/admin/Desktop/docx-to-pdf-converter:/dist/infrastructure/adapters/native/cli.js",
	}

	var cliPath string
	for _, p := range cliPaths {
		if _, err := os.Stat(p); err == nil {
			cliPath = p
			break
		}
	}

	if cliPath == "" {
		return &DesktopConversionResult{
			Success:      false,
			OutputPath:   "",
			ErrorMessage: "Could not locate Node.js converter CLI script (dist/infrastructure/adapters/native/cli.js)",
			DurationMs:   time.Since(startTime).Milliseconds(),
		}
	}

	// 4. Run the Node.js subprocess to do the conversion
	cmd := exec.Command("node", cliPath, sourcePath, savePath)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return &DesktopConversionResult{
			Success:      false,
			OutputPath:   "",
			ErrorMessage: fmt.Sprintf("Node.js conversion process failed: %s. Output: %s", err.Error(), string(output)),
			DurationMs:   time.Since(startTime).Milliseconds(),
		}
	}

	duration := time.Since(startTime).Milliseconds()

	return &DesktopConversionResult{
		Success:      true,
		OutputPath:   savePath,
		ErrorMessage: "",
		DurationMs:   duration,
	}
}

// OpenFileLocation opens the folder containing the file in Finder/Explorer
func (a *App) OpenFileLocation(outputPath string) {
	dir := filepath.Dir(outputPath)
	runtime.BrowserOpenURL(a.ctx, dir)
}

// SelectFile opens a native file dialog to choose a DOCX file
func (a *App) SelectFile() string {
	path, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select Word Document",
		Filters: []runtime.FileFilter{
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


