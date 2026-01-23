package main

import (
	"image/color"
	"log"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/app"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/theme"
	"fyne.io/fyne/v2/widget"
)

func main() {
	a := app.NewWithID("dev.arbora.canvas")
	a.Settings().SetTheme(&arboraTheme{})

	w := a.NewWindow("Arbora Canvas")
	w.Resize(fyne.NewSize(600, 800))

	state := NewAppState()

	// Create the tree view widget
	treeView := NewTreeView(state)

	// Status bar at bottom
	statusLabel := widget.NewLabel("Waiting for draft...")
	statusLabel.TextStyle = fyne.TextStyle{Monospace: true}

	// Main layout
	content := container.NewBorder(
		nil,                               // top
		statusLabel,                       // bottom
		nil,                               // left
		nil,                               // right
		container.NewVScroll(treeView.UI), // center
	)

	w.SetContent(content)

	// Update UI when draft changes
	state.AddListener(func(draft *DraftTree) {
		if draft != nil {
			statusLabel.SetText("Draft: " + draft.Draft.Name + " | " + draft.Draft.Status)
			treeView.Update(draft)
		} else {
			statusLabel.SetText("Waiting for draft...")
		}
	})

	// Start socket server in background
	go StartSocketServer(state, func() {
		w.Show()
		w.RequestFocus()
	}, func() {
		w.Hide()
	})

	log.Println("Arbora Canvas starting...")
	w.ShowAndRun()

	// Cleanup on exit
	CleanupSocket()
}

// Custom theme for Catppuccin-like colors
type arboraTheme struct{}

func (t *arboraTheme) Color(name fyne.ThemeColorName, variant fyne.ThemeVariant) color.Color {
	switch name {
	case theme.ColorNameBackground:
		return color.RGBA{R: 30, G: 30, B: 46, A: 255} // Base
	case theme.ColorNameForeground:
		return color.RGBA{R: 205, G: 214, B: 244, A: 255} // Text
	case theme.ColorNamePrimary:
		return color.RGBA{R: 137, G: 180, B: 250, A: 255} // Blue
	case theme.ColorNameDisabled:
		return color.RGBA{R: 108, G: 112, B: 134, A: 255} // Overlay0
	default:
		return theme.DefaultTheme().Color(name, variant)
	}
}

func (t *arboraTheme) Font(style fyne.TextStyle) fyne.Resource {
	return theme.DefaultTheme().Font(style)
}

func (t *arboraTheme) Icon(name fyne.ThemeIconName) fyne.Resource {
	return theme.DefaultTheme().Icon(name)
}

func (t *arboraTheme) Size(name fyne.ThemeSizeName) float32 {
	if name == theme.SizeNameText {
		return 13
	}
	return theme.DefaultTheme().Size(name)
}
