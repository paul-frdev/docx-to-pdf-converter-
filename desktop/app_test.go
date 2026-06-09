package main

import (
	"os"
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
