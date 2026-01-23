package main

import (
	"bytes"
	"context"
	"image"
	"log"
	"strings"

	"oss.terrastruct.com/d2/d2graph"
	"oss.terrastruct.com/d2/d2layouts/d2dagrelayout"
	"oss.terrastruct.com/d2/d2lib"
	"oss.terrastruct.com/d2/d2renderers/d2svg"
	"oss.terrastruct.com/d2/d2themes/d2themescatalog"
	"oss.terrastruct.com/d2/lib/textmeasure"

	"github.com/srwiley/oksvg"
	"github.com/srwiley/rasterx"
)

// RenderD2 renders a D2 diagram string to an image
func RenderD2(content string) (image.Image, error) {
	ctx := context.Background()

	// Create ruler for text measurement
	ruler, err := textmeasure.NewRuler()
	if err != nil {
		return nil, err
	}

	// Compile the D2 script
	compileOpts := &d2lib.CompileOptions{
		LayoutResolver: func(engine string) (d2graph.LayoutGraph, error) {
			return d2dagrelayout.DefaultLayout, nil
		},
		Ruler: ruler,
	}

	diagram, _, err := d2lib.Compile(ctx, content, compileOpts, nil)
	if err != nil {
		log.Printf("D2 compile error: %v", err)
		return nil, err
	}

	// Render to SVG with dark theme
	pad := int64(100)
	themeID := d2themescatalog.DarkMauve.ID
	renderOpts := &d2svg.RenderOpts{
		Pad:     &pad,
		ThemeID: &themeID,
	}

	svg, err := d2svg.Render(diagram, renderOpts)
	if err != nil {
		log.Printf("D2 render error: %v", err)
		return nil, err
	}

	// Convert SVG to image using oksvg
	return svgToImage(svg)
}

// svgToImage converts SVG bytes to a Go image
func svgToImage(svg []byte) (image.Image, error) {
	reader := bytes.NewReader(svg)
	icon, err := oksvg.ReadIconStream(reader)
	if err != nil {
		return nil, err
	}

	// Get dimensions
	w := int(icon.ViewBox.W)
	h := int(icon.ViewBox.H)

	// Ensure minimum size
	if w < 100 {
		w = 400
	}
	if h < 100 {
		h = 300
	}

	// Cap maximum size
	if w > 1200 {
		scale := 1200.0 / float64(w)
		w = 1200
		h = int(float64(h) * scale)
	}

	icon.SetTarget(0, 0, float64(w), float64(h))

	// Create image and rasterize
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	scanner := rasterx.NewScannerGV(w, h, img, img.Bounds())
	raster := rasterx.NewDasher(w, h, scanner)
	icon.Draw(raster, 1.0)

	return img, nil
}

// ConvertMermaidToD2 provides a best-effort conversion of Mermaid syntax to D2
func ConvertMermaidToD2(mermaid string) string {
	lines := strings.Split(mermaid, "\n")
	var d2Lines []string

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)

		// Skip Mermaid directives
		if strings.HasPrefix(trimmed, "graph") ||
			strings.HasPrefix(trimmed, "flowchart") ||
			strings.HasPrefix(trimmed, "sequenceDiagram") ||
			strings.HasPrefix(trimmed, "classDiagram") ||
			strings.HasPrefix(trimmed, "stateDiagram") ||
			strings.HasPrefix(trimmed, "erDiagram") ||
			strings.HasPrefix(trimmed, "%%") {
			continue
		}

		// Convert common Mermaid patterns to D2
		converted := line

		// Arrow conversions: --> to ->
		converted = strings.ReplaceAll(converted, "-->", "->")
		converted = strings.ReplaceAll(converted, "-.->", "->")
		converted = strings.ReplaceAll(converted, "==>", "->")

		// Box definitions: A[Text] to A: Text
		if strings.Contains(converted, "[") && strings.Contains(converted, "]") {
			// Simple pattern matching for node definitions
			// This is a basic conversion - complex Mermaid may need manual adjustment
		}

		if strings.TrimSpace(converted) != "" {
			d2Lines = append(d2Lines, converted)
		}
	}

	return strings.Join(d2Lines, "\n")
}
