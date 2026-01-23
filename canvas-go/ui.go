package main

import (
	"fmt"
	"image"
	"image/color"
	"log"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/canvas"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/widget"
)

// Colors (Catppuccin Mocha)
var (
	colorText     = color.RGBA{205, 214, 244, 255} // Text
	colorSubtext  = color.RGBA{166, 173, 200, 255} // Subtext0
	colorOverlay  = color.RGBA{108, 112, 134, 255} // Overlay0
	colorGreen    = color.RGBA{166, 227, 161, 255} // Green
	colorYellow   = color.RGBA{249, 226, 175, 255} // Yellow
	colorRed      = color.RGBA{243, 139, 168, 255} // Red
	colorBlue     = color.RGBA{137, 180, 250, 255} // Blue
	colorMauve    = color.RGBA{203, 166, 247, 255} // Mauve
	colorSapphire = color.RGBA{116, 199, 236, 255} // Sapphire
)

// TreeView displays the draft tree
type TreeView struct {
	UI        *fyne.Container
	content   *fyne.Container
	header    *canvas.Text
	subheader *canvas.Text
	stats     *canvas.Text
}

// NewTreeView creates a new tree view widget
func NewTreeView(state *AppState) *TreeView {
	header := canvas.NewText("Arbora Canvas", colorText)
	header.TextSize = 16
	header.TextStyle = fyne.TextStyle{Bold: true, Monospace: true}

	subheader := canvas.NewText("Waiting for draft...", colorOverlay)
	subheader.TextSize = 12
	subheader.TextStyle = fyne.TextStyle{Monospace: true}

	stats := canvas.NewText("", colorOverlay)
	stats.TextSize = 12
	stats.TextStyle = fyne.TextStyle{Monospace: true}

	content := container.NewVBox()

	headerBox := container.NewVBox(
		header,
		subheader,
		widget.NewSeparator(),
	)

	statsBox := container.NewVBox(
		widget.NewSeparator(),
		stats,
	)

	ui := container.NewBorder(
		headerBox,
		statsBox,
		nil,
		nil,
		content,
	)

	return &TreeView{
		UI:        ui,
		content:   content,
		header:    header,
		subheader: subheader,
		stats:     stats,
	}
}

// Update refreshes the tree view with new draft data
func (tv *TreeView) Update(draft *DraftTree) {
	if draft == nil {
		return
	}

	// Update header
	tv.header.Text = "📋 " + draft.Draft.Name
	tv.header.Refresh()

	tv.subheader.Text = fmt.Sprintf("[%s] %s", draft.Draft.DraftType, draft.Draft.Status)
	tv.subheader.Color = getStatusColor(draft.Draft.Status)
	tv.subheader.Refresh()

	// Clear and rebuild content
	tv.content.Objects = nil

	// Render based on template type
	switch draft.Template {
	case "flat":
		tv.renderFlatTemplate(draft)
	case "spatial":
		tv.renderSpatialTemplate(draft)
	default:
		// matrix or temporal
		tv.renderPhasesTemplate(draft)
	}

	// Update stats
	completed, total := countTasks(draft)
	tv.stats.Text = fmt.Sprintf("📊 %d phases, %d scopes, %d/%d tasks",
		draft.Stats.Phases, draft.Stats.Scopes, completed, total)
	tv.stats.Refresh()

	tv.content.Refresh()
}

// renderFlatTemplate renders tasks directly under draft
func (tv *TreeView) renderFlatTemplate(draft *DraftTree) {
	for i, task := range draft.Tasks {
		isLast := i == len(draft.Tasks)-1
		tv.content.Add(tv.renderTask(task, isLast, ""))
	}
}

// renderSpatialTemplate renders scopes directly under draft
func (tv *TreeView) renderSpatialTemplate(draft *DraftTree) {
	for i, scope := range draft.Scopes {
		isLast := i == len(draft.Scopes)-1
		tv.content.Add(tv.renderScope(scope, isLast, ""))
	}
}

// renderPhasesTemplate renders phases -> scopes -> tasks
func (tv *TreeView) renderPhasesTemplate(draft *DraftTree) {
	for i, phase := range draft.Phases {
		isLast := i == len(draft.Phases)-1
		tv.content.Add(tv.renderPhase(phase, isLast))
	}
}

// renderPhase renders a phase node
func (tv *TreeView) renderPhase(phase Phase, isLast bool) fyne.CanvasObject {
	prefix := "├─"
	childPrefix := "│  "
	if isLast {
		prefix = "└─"
		childPrefix = "   "
	}

	// Phase header
	statusIcon := getStatusIcon(phase.Status)
	headerText := fmt.Sprintf("%s %s %s", prefix, statusIcon, phase.Name)

	header := canvas.NewText(headerText, getStatusColor(phase.Status))
	header.TextStyle = fyne.TextStyle{Bold: true, Monospace: true}

	phaseBox := container.NewVBox(header)

	// Diagrams
	for j, diagram := range phase.Diagrams {
		isDiagLast := j == len(phase.Diagrams)-1 && len(phase.Scopes) == 0
		diagPrefix := childPrefix + "├─"
		if isDiagLast {
			diagPrefix = childPrefix + "└─"
		}

		diagText := fmt.Sprintf("%s 📊 %s [%s]", diagPrefix, diagram.Name, diagram.Type)
		diagLabel := canvas.NewText(diagText, colorMauve)
		diagLabel.TextStyle = fyne.TextStyle{Monospace: true}
		phaseBox.Add(diagLabel)
	}

	// Scopes
	for j, scope := range phase.Scopes {
		isScopeLast := j == len(phase.Scopes)-1
		phaseBox.Add(tv.renderScope(scope, isScopeLast, childPrefix))
	}

	return phaseBox
}

// renderScope renders a scope node
func (tv *TreeView) renderScope(scope Scope, isLast bool, parentPrefix string) fyne.CanvasObject {
	prefix := parentPrefix + "├─"
	childPrefix := parentPrefix + "│  "
	if isLast {
		prefix = parentPrefix + "└─"
		childPrefix = parentPrefix + "   "
	}

	statusIcon := getStatusIcon(scope.Status)
	headerText := fmt.Sprintf("%s %s %s", prefix, statusIcon, scope.Name)

	header := canvas.NewText(headerText, getStatusColor(scope.Status))
	header.TextStyle = fyne.TextStyle{Monospace: true}

	scopeBox := container.NewVBox(header)

	// Tasks
	for j, task := range scope.Tasks {
		isTaskLast := j == len(scope.Tasks)-1
		scopeBox.Add(tv.renderTask(task, isTaskLast, childPrefix))
	}

	return scopeBox
}

// renderTask renders a task node
func (tv *TreeView) renderTask(task Task, isLast bool, parentPrefix string) fyne.CanvasObject {
	prefix := parentPrefix + "├─"
	if isLast {
		prefix = parentPrefix + "└─"
	}

	checkbox := "[ ]"
	textColor := colorText
	if task.Completed {
		checkbox = "[✓]"
		textColor = colorGreen
	}

	taskText := fmt.Sprintf("%s %s %s", prefix, checkbox, task.Title)
	taskLabel := canvas.NewText(taskText, textColor)
	taskLabel.TextStyle = fyne.TextStyle{Monospace: true}

	return taskLabel
}

// Helper functions
func getStatusColor(status string) color.Color {
	switch status {
	case "done":
		return colorGreen
	case "active":
		return colorYellow
	case "queued":
		return colorOverlay
	case "dropped":
		return colorRed
	default:
		return colorText
	}
}

func getStatusIcon(status string) string {
	switch status {
	case "done":
		return "✓"
	case "active":
		return "●"
	case "queued":
		return "○"
	case "dropped":
		return "✗"
	default:
		return "○"
	}
}

func countTasks(draft *DraftTree) (completed, total int) {
	// Flat template
	for _, task := range draft.Tasks {
		total++
		if task.Completed {
			completed++
		}
	}

	// Spatial template
	for _, scope := range draft.Scopes {
		for _, task := range scope.Tasks {
			total++
			if task.Completed {
				completed++
			}
		}
	}

	// Phases
	for _, phase := range draft.Phases {
		for _, scope := range phase.Scopes {
			for _, task := range scope.Tasks {
				total++
				if task.Completed {
					completed++
				}
			}
		}
	}

	return
}

// DiagramViewer displays a rendered diagram
type DiagramViewer struct {
	Window    fyne.Window
	container *fyne.Container
	imgCanvas *canvas.Image
	title     *canvas.Text
	status    *canvas.Text
}

// NewDiagramViewer creates a new diagram viewer window
func NewDiagramViewer(app fyne.App) *DiagramViewer {
	win := app.NewWindow("Diagram Viewer")
	win.Resize(fyne.NewSize(800, 600))

	title := canvas.NewText("", colorText)
	title.TextSize = 14
	title.TextStyle = fyne.TextStyle{Bold: true, Monospace: true}

	status := canvas.NewText("Press ESC or Q to close", colorOverlay)
	status.TextSize = 11
	status.TextStyle = fyne.TextStyle{Monospace: true}

	imgCanvas := canvas.NewImageFromImage(nil)
	imgCanvas.FillMode = canvas.ImageFillContain

	header := container.NewVBox(title, widget.NewSeparator())
	footer := container.NewVBox(widget.NewSeparator(), status)

	c := container.NewBorder(header, footer, nil, nil, imgCanvas)

	win.SetContent(c)

	// Handle window close
	win.SetCloseIntercept(func() {
		win.Hide()
	})

	return &DiagramViewer{
		Window:    win,
		container: c,
		imgCanvas: imgCanvas,
		title:     title,
		status:    status,
	}
}

// Show displays the diagram
func (dv *DiagramViewer) Show(diagram Diagram) {
	dv.title.Text = fmt.Sprintf("📊 %s [%s]", diagram.Name, diagram.Type)
	dv.title.Refresh()

	// Render diagram based on type
	var img image.Image
	var err error

	switch diagram.Type {
	case "d2":
		img, err = RenderD2(diagram.Content)
	case "mermaid":
		// Convert Mermaid to D2 and render
		d2Content := ConvertMermaidToD2(diagram.Content)
		img, err = RenderD2(d2Content)
		if err != nil {
			dv.status.Text = "Mermaid conversion may be incomplete - try D2 format"
			dv.status.Color = colorYellow
			dv.status.Refresh()
		}
	default:
		// Try rendering as D2
		img, err = RenderD2(diagram.Content)
	}

	if err != nil {
		log.Printf("Diagram render error: %v", err)
		dv.status.Text = fmt.Sprintf("Render error: %v", err)
		dv.status.Color = colorRed
		dv.status.Refresh()
		// Show error but still open window
	} else {
		dv.status.Text = "Press ESC or Q to close"
		dv.status.Color = colorOverlay
		dv.status.Refresh()
	}

	if img != nil {
		dv.imgCanvas.Image = img
		dv.imgCanvas.Refresh()
	}

	dv.Window.Show()
	dv.Window.RequestFocus()
}
