package authmodule

import (
	"strings"
	"testing"
)

func TestVerifySliderOffsetAcceptsSmallTolerance(t *testing.T) {
	if !verifySliderOffset(128, 133, 6) {
		t.Fatal("verifySliderOffset returned false, want true")
	}
}

func TestVerifySliderOffsetRejectsOutsideTolerance(t *testing.T) {
	if verifySliderOffset(128, 136, 6) {
		t.Fatal("verifySliderOffset returned true, want false")
	}
}

func TestNewSliderChallengeKeepsTargetInsideTrack(t *testing.T) {
	challenge, err := newSliderChallenge()
	if err != nil {
		t.Fatal(err)
	}

	maxX := challenge.Width - challenge.PieceSize
	if challenge.TargetX <= challenge.InitialX || challenge.TargetX >= maxX {
		t.Fatalf("TargetX = %d, want between %d and %d", challenge.TargetX, challenge.InitialX, maxX)
	}
	if challenge.TargetY <= 0 || challenge.TargetY >= challenge.Height-challenge.PieceSize {
		t.Fatalf("TargetY = %d, want inside puzzle image", challenge.TargetY)
	}
}

func TestNewSliderChallengeUsesCompactLoginSize(t *testing.T) {
	challenge, err := newSliderChallenge()
	if err != nil {
		t.Fatal(err)
	}

	if challenge.Width != 280 || challenge.Height != 120 {
		t.Fatalf("challenge size = %dx%d, want 280x120", challenge.Width, challenge.Height)
	}
	if challenge.PieceSize != 44 {
		t.Fatalf("piece_size = %d, want 44", challenge.PieceSize)
	}
}

func TestSVGDataURIDoesNotUseQueryPlusForSpaces(t *testing.T) {
	uri := svgDataURI(`<svg xmlns="http://www.w3.org/2000/svg"></svg>`)
	parts := strings.SplitN(uri, ",", 2)
	if len(parts) != 2 {
		t.Fatalf("svgDataURI returned %q, want data URI with comma separator", uri)
	}

	if strings.Contains(parts[1], "+") {
		t.Fatalf("svgDataURI returned %q, want spaces percent encoded instead of plus", uri)
	}
}

func TestSliderBackgroundSVGProducesVariedOutputs(t *testing.T) {
	seen := make(map[string]int)
	for seed := 0; seed < 100; seed++ {
		svg := sliderBackgroundSVG(100, 40, seed)
		if !strings.HasPrefix(svg, "<svg") {
			t.Fatalf("seed %d: not an SVG", seed)
		}
		if !strings.Contains(svg, "url(#bg)") || !strings.Contains(svg, "url(#tex)") {
			t.Fatalf("seed %d: missing expected elements", seed)
		}
		if !strings.Contains(svg, "<circle") {
			t.Fatalf("seed %d: missing noise dots", seed)
		}
		if !strings.Contains(svg, "<line") {
			t.Fatalf("seed %d: missing interference lines", seed)
		}
		seen[svg]++
		if seen[svg] > 1 {
			t.Fatalf("seed %d and earlier produced identical SVG", seed)
		}
	}
}

func TestSliderPieceSVGUsesMultipleShapes(t *testing.T) {
	shapes := make(map[string]int)
	for seed := 0; seed < 100; seed++ {
		svg := sliderPieceSVG(seed)
		if !strings.HasPrefix(svg, "<svg") {
			t.Fatalf("seed %d: not an SVG", seed)
		}
		if !strings.Contains(svg, "hsl(") {
			t.Fatalf("seed %d: missing hsl color", seed)
		}
		shapes[svg]++
	}
	// With 8 different puzzle shapes, we should see at least 4 unique SVGs
	if len(shapes) < 4 {
		t.Fatalf("only %d unique piece shapes across 100 seeds, want at least 4", len(shapes))
	}
	t.Logf("%d unique piece SVGs across 100 seeds", len(shapes))
}
