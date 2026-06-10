package main

import (
	"context"
	"os"
	"strings"
	"testing"
)

func TestGetEmbeddedOfficePath(t *testing.T) {
	path, err := getEmbeddedOfficePath()
	if err != nil {
		t.Logf("Embedded path resolved to error: %v (this is expected if LibreOffice is not installed/embedded on the test machine)", err)
	} else {
		t.Logf("Embedded path resolved to: %s", path)
		if _, statErr := os.Stat(path); statErr != nil {
			t.Errorf("Path was returned but file does not exist: %v", statErr)
		}
	}
}

func TestConvertFile_Validation(t *testing.T) {
	app := NewApp()

	// Set up channel to capture asynchronous results
	ch := make(chan *DesktopConversionResult, 1)
	app.onConversionResult = func(res *DesktopConversionResult) {
		ch <- res
	}

	// Case 1: Non-existent file path
	app.ConvertFile("nonexistent_file.docx", AppConfigMetadata{})
	res := <-ch
	if res.Success {
		t.Error("Expected failure for non-existent file path, but got success")
	}
	if res.ErrorMessage == "" {
		t.Error("Expected an error message for non-existent file path, but it was empty")
	}

	// Case 2: Dummy file exceeding 50MB
	tempFileLarge, err := os.CreateTemp("", "large_test_*.docx")
	if err != nil {
		t.Fatalf("Failed to create temporary file: %v", err)
	}
	defer os.Remove(tempFileLarge.Name())
	defer tempFileLarge.Close()

	if err := tempFileLarge.Truncate(52428801); err != nil {
		t.Fatalf("Failed to truncate file to large size: %v", err)
	}
	tempFileLarge.Close()

	app.ConvertFile(tempFileLarge.Name(), AppConfigMetadata{})
	res = <-ch
	if res.Success {
		t.Error("Expected failure for file exceeding 50MB, but got success")
	}
	expectedErrorLarge := "FILE_TOO_LARGE: File size exceeds the maximum allowable limit of 50MB"
	if res.ErrorMessage != expectedErrorLarge {
		t.Errorf("Expected error %q, got %q", expectedErrorLarge, res.ErrorMessage)
	}

	// Case 3: Dummy 10-byte text file with invalid magic bytes
	tempFileInvalidSig, err := os.CreateTemp("", "invalid_sig_*.docx")
	if err != nil {
		t.Fatalf("Failed to create temporary file: %v", err)
	}
	defer os.Remove(tempFileInvalidSig.Name())
	defer tempFileInvalidSig.Close()

	if _, err := tempFileInvalidSig.Write([]byte("not ooxml!")); err != nil {
		t.Fatalf("Failed to write invalid signature content: %v", err)
	}
	tempFileInvalidSig.Close()

	app.ConvertFile(tempFileInvalidSig.Name(), AppConfigMetadata{})
	res = <-ch
	if res.Success {
		t.Error("Expected failure for file with invalid signature, but got success")
	}
	expectedErrorSig := "INVALID_DOCX_SIGNATURE: The provided file is not a valid OOXML document"
	if res.ErrorMessage != expectedErrorSig {
		t.Errorf("Expected error %q, got %q", expectedErrorSig, res.ErrorMessage)
	}
}

func TestScanStdoutAndEmit(t *testing.T) {
	app := NewApp()
	app.ctx = context.Background()

	inputStr := "Some initial output\n[STATUS]: PARSING\nSome intermediate log\n[STATUS]: CONVERTING\nAnother log line\n[STATUS]: COMPLETED\nFinal log line\n"
	reader := strings.NewReader(inputStr)

	stdoutCollected := app.scanStdoutAndEmit(reader)

	expectedCollected := "Some initial output\n[STATUS]: PARSING\nSome intermediate log\n[STATUS]: CONVERTING\nAnother log line\n[STATUS]: COMPLETED\nFinal log line\n"
	if stdoutCollected != expectedCollected {
		t.Errorf("Expected collected stdout to be %q, got %q", expectedCollected, stdoutCollected)
	}
}
