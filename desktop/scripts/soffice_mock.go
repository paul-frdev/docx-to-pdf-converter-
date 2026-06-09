package main

import (
	"fmt"
	"os"
	"path/filepath"
)

func main() {
	fmt.Printf("Mock LibreOffice soffice CLI invoked with args: %v\n", os.Args)

	var outdir string
	for i := 0; i < len(os.Args)-1; i++ {
		if os.Args[i] == "--outdir" {
			outdir = os.Args[i+1]
			break
		}
	}

	if outdir != "" {
		// Ensure the outdir exists
		if err := os.MkdirAll(outdir, 0755); err != nil {
			fmt.Fprintf(os.Stderr, "Error creating output directory: %v\n", err)
			os.Exit(1)
		}

		// Write a valid mock PDF file
		pdfPath := filepath.Join(outdir, "input.pdf")
		mockPdfContent := []byte("%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000056 00000 n\n0000000111 00000 n\ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n190\n%%EOF\n")
		
		if err := os.WriteFile(pdfPath, mockPdfContent, 0644); err != nil {
			fmt.Fprintf(os.Stderr, "Error writing mock PDF: %v\n", err)
			os.Exit(1)
		}
		fmt.Printf("Successfully generated mock PDF at %s\n", pdfPath)
	} else {
		fmt.Fprintln(os.Stderr, "Error: --outdir argument not found")
		os.Exit(1)
	}
}
