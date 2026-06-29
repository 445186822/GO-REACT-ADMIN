package authmodule

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"math/big"
	"net/url"
	"strings"
)

const (
	sliderCaptchaWidth     = 280
	sliderCaptchaHeight    = 120
	sliderCaptchaPieceSize = 44
	sliderCaptchaInitialX  = 0
	sliderCaptchaTolerance = 6
)

type CaptchaChallengeResponse struct {
	ChallengeID string `json:"challenge_id"`
	Type        string `json:"type"`
	Width       int    `json:"width"`
	Height      int    `json:"height"`
	PieceSize   int    `json:"piece_size"`
	InitialX    int    `json:"initial_x"`
	TargetX     int    `json:"target_x"`
	TargetY     int    `json:"target_y"`
	Tolerance   int    `json:"tolerance"`
	Background  string `json:"background"`
	Piece       string `json:"piece"`
	ExpiresIn   int    `json:"expires_in"`
}

type CaptchaVerifyRequest struct {
	ChallengeID string             `json:"challenge_id"`
	X           int                `json:"x"`
	Track       []SliderTrackPoint `json:"track"`
}

type SliderTrackPoint struct {
	X int `json:"x"`
	T int `json:"t"`
}

type sliderChallenge struct {
	CaptchaChallengeResponse
	ImageSeed int
}

func newSliderChallenge() (sliderChallenge, error) {
	id, err := randomHex(16)
	if err != nil {
		return sliderChallenge{}, err
	}
	seed, err := randomInt(100000)
	if err != nil {
		return sliderChallenge{}, err
	}
	// Leave margin so the hole isn't right against the edge.
	targetXOffset, err := randomInt(sliderCaptchaWidth - sliderCaptchaPieceSize - 72)
	if err != nil {
		return sliderChallenge{}, err
	}
	targetYOffset, err := randomInt(sliderCaptchaHeight - sliderCaptchaPieceSize - 24)
	if err != nil {
		return sliderChallenge{}, err
	}
	targetX := 48 + targetXOffset
	targetY := 12 + targetYOffset

	challenge := sliderChallenge{
		CaptchaChallengeResponse: CaptchaChallengeResponse{
			ChallengeID: id,
			Type:        "slider",
			Width:       sliderCaptchaWidth,
			Height:      sliderCaptchaHeight,
			PieceSize:   sliderCaptchaPieceSize,
			InitialX:    sliderCaptchaInitialX,
			TargetX:     targetX,
			TargetY:     targetY,
			Tolerance:   sliderCaptchaTolerance,
			Background:  svgDataURI(sliderBackgroundSVG(targetX, targetY, seed)),
			Piece:       svgDataURI(sliderPieceSVG(seed)),
		},
		ImageSeed: seed,
	}
	return challenge, nil
}

func verifySliderOffset(expectedX int, actualX int, tolerance int) bool {
	delta := expectedX - actualX
	if delta < 0 {
		delta = -delta
	}
	return delta <= tolerance
}

// ── SVG generation ──────────────────────────────────────────────

// 8 puzzle-piece paths normalised to a ~50×50 bounding box.
// The piece and background hole use the same path → sizes match exactly.
var puzzlePaths = []string{
	"M2 16H16C13 7 20 2 26 2C32 2 39 7 36 16H50V30C42 27 37 34 37 40C37 46 42 53 50 50V50H2V36C10 39 15 32 15 26C15 20 10 13 2 16Z",
	"M2 15H18C15 24 22 2 27 2C32 2 39 24 34 15H50V32C43 35 37 28 37 34C37 40 43 33 50 36V50H2V38C8 35 13 42 13 36C13 30 8 37 2 34Z",
	"M2 14H16C19 5 24 8 27 2C30 8 33 5 36 14H50V33C44 30 38 37 38 43C38 49 44 42 50 39V50H2V36C9 39 14 32 14 26C14 20 9 13 2 16Z",
	"M3 18H18C15 9 21 5 26 3C31 5 37 9 34 18H49V31C43 28 38 35 38 41C38 47 43 40 49 37V49H3V37C10 40 15 33 15 27C15 21 10 14 3 17Z",
	"M2 13H17C14 4 21 2 26 2C30 2 38 6 34 13H50V29C43 32 38 25 37 31C36 37 42 30 50 33V50H2V37C9 34 14 41 14 35C14 29 8 36 2 33Z",
	"M1 17H16C13 26 20 3 25 3C31 3 37 25 35 17H51V30C45 27 39 34 39 40C39 46 44 39 51 36V51H1V36C8 39 13 32 13 26C13 20 8 13 1 16Z",
	"M2 15H15C18 5 24 8 27 2C30 9 35 6 38 15H50V32C44 29 37 36 37 42C37 48 42 40 50 37V50H2V38C8 41 14 34 14 28C14 22 9 15 2 18Z",
	"M3 16H17C14 24 20 3 26 3C32 3 38 23 35 16H49V29C44 32 38 25 37 31C36 37 42 29 49 32V49H3V37C10 34 15 41 15 35C15 29 10 36 3 33Z",
}

type bgTheme struct{ c1, c2 string }

func backgroundTheme(seed int) bgTheme {
	all := []bgTheme{
		{c1: "hsl(210 40% 78%)", c2: "hsl(210 25% 44%)"},
		{c1: "hsl(35 45% 82%)", c2: "hsl(35 28% 50%)"},
		{c1: "hsl(155 38% 77%)", c2: "hsl(155 24% 40%)"},
		{c1: "hsl(285 35% 83%)", c2: "hsl(285 22% 48%)"},
		{c1: "hsl(12 44% 81%)", c2: "hsl(12 30% 46%)"},
		{c1: "hsl(48 40% 84%)", c2: "hsl(48 28% 44%)"},
		{c1: "hsl(195 42% 78%)", c2: "hsl(195 28% 42%)"},
		{c1: "hsl(340 32% 85%)", c2: "hsl(340 20% 50%)"},
	}
	return all[seed%len(all)]
}

func sliderBackgroundSVG(targetX int, targetY int, seed int) string {
	t := backgroundTheme(seed)
	puzzleIdx := seed % len(puzzlePaths)

	var b strings.Builder

	// ── Large visible distractors ──
	for i := 0; i < 22; i++ {
		x := (seed*7 + i*31) % (sliderCaptchaWidth - 40)
		y := (seed*13 + i*17) % (sliderCaptchaHeight - 24)
		w := 12 + (seed+i*3)%22
		h := 6 + (seed+i*5)%16
		op := 0.12 + float64((seed+i)%10)*0.025
		rx := 2 + (seed+i)%7
		fmt.Fprintf(&b, `<rect x="%d" y="%d" width="%d" height="%d" rx="%d" fill="rgba(255,255,255,%.2f)"/>`,
			x, y, w, h, rx, op)
	}
	// Dark distracting rectangles for contrast
	for i := 0; i < 10; i++ {
		x := (seed*17 + i*43) % (sliderCaptchaWidth - 30)
		y := (seed*29 + i*37) % (sliderCaptchaHeight - 16)
		w := 8 + (seed+i*7)%16
		h := 4 + (seed+i*11)%10
		op := 0.08 + float64((seed+i)%8)*0.015
		rx := 2 + (seed+i)%5
		fmt.Fprintf(&b, `<rect x="%d" y="%d" width="%d" height="%d" rx="%d" fill="rgba(0,0,0,%.2f)"/>`,
			x, y, w, h, rx, op)
	}

	// ── Interference lines (thicker, more visible) ──
	lineCount := 5 + seed%5
	for i := 0; i < lineCount; i++ {
		y := (seed*23 + i*41) % sliderCaptchaHeight
		x1 := (seed*11 + i*19) % 40
		x2 := sliderCaptchaWidth - ((seed*17 + i*13) % 40)
		sw := 1.0 + float64(i%4)*0.6
		op := 0.10 + float64((seed+i)%6)*0.025
		dark := (seed+i)%2 == 0
		color := "255,255,255"
		if dark {
			color = "0,0,0"
		}
		fmt.Fprintf(&b, `<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="rgba(%s,%.2f)" stroke-width="%.1f"/>`,
			x1, y, x2, y, color, op, sw)
	}

	// ── Zigzag interference near the gap ──
	for i := 0; i < 3; i++ {
		startY := targetY - 19 + i*19
		if startY < 4 {
			startY = 4
		}
		if startY > sliderCaptchaHeight-6 {
			startY = sliderCaptchaHeight - 6
		}
		var zig strings.Builder
		px := 8
		py := startY
		for j := 0; j < sliderCaptchaWidth/14; j++ {
			px += 12 + j%6
			pyOff := 4 - j%9
			fmt.Fprintf(&zig, "L%d %d ", px, py+pyOff)
		}
		fmt.Fprintf(&b, `<path d="M8 %d %s" fill="none" stroke="rgba(0,0,0,0.10)" stroke-width="1.2"/>`, startY, zig.String())
	}

	// ── Noise dots ──
	dotCount := 100 + seed%60
	for i := 0; i < dotCount; i++ {
		x := (seed*31 + i*53 + i*i*7) % sliderCaptchaWidth
		y := (seed*19 + i*41 + i*i*11) % sliderCaptchaHeight
		r := 0.5 + float64((seed+i)%10)*0.22
		op := 0.12 + float64((seed*3+i)%8)*0.03
		// Mix dark and light dots
		color := "0,0,0"
		if (seed+i)%3 == 0 {
			color = "255,255,255"
			op += 0.04
		}
		fmt.Fprintf(&b, `<circle cx="%d" cy="%d" r="%.1f" fill="rgba(%s,%.2f)"/>`,
			x, y, r, color, op)
	}

	// Scale factor: piece is 44px but paths are ~52 units → scale down to match.
	scale := float64(sliderCaptchaPieceSize) / 52.0

	return fmt.Sprintf(`<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d">
	<defs>
	<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="%s"/><stop offset="1" stop-color="%s"/></linearGradient>
	<linearGradient id="overlay" x1="0" y1="0" x2="1" y2="0"><stop stop-color="rgba(255,255,255,.14)"/><stop offset=".5" stop-color="rgba(0,0,0,.06)"/><stop offset="1" stop-color="rgba(255,255,255,.10)"/></linearGradient>
	<filter id="shadow"><feDropShadow dx="0" dy="1" stdDeviation="1.6" flood-opacity=".35"/></filter>
	<filter id="tex"><feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" seed="%d"/><feColorMatrix type="saturate" values="0"/></filter>
	</defs>
	<rect width="100%%" height="100%%" fill="url(#bg)"/>
	<rect width="100%%" height="100%%" fill="url(#overlay)"/>
	<rect width="100%%" height="100%%" filter="url(#tex)" opacity=".08"/>
	%s
	<g transform="translate(%d %d) scale(%.4f)" filter="url(#shadow)">
	<path d="%s" fill="rgba(255,255,255,.78)" stroke="rgba(255,255,255,.92)" stroke-width="2"/>
	</g>
	</svg>`, sliderCaptchaWidth, sliderCaptchaHeight, sliderCaptchaWidth, sliderCaptchaHeight,
		t.c1, t.c2, seed,
		b.String(),
		targetX, targetY, scale, puzzlePaths[puzzleIdx])
}

func sliderPieceSVG(seed int) string {
	puzzleIdx := seed % len(puzzlePaths)
	h := (seed * 37) % 360
	s := 40 + seed%25
	l := 55 + seed%20
	color1 := fmt.Sprintf("hsl(%d %d%% %d%%)", h, s, l)
	color2 := fmt.Sprintf("hsl(%d %d%% %d%%)", (h+25)%360, s-8, l-12)

	// Rendered at piece_size (44px); paths are in 52×52 coords → viewBox handles scaling.
	return fmt.Sprintf(`<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 52 52">
	<defs>
	<linearGradient id="piece" x1="0" y1="0" x2="1" y2="1"><stop stop-color="%s"/><stop offset="1" stop-color="%s"/></linearGradient>
	<filter id="edge"><feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-opacity=".40"/></filter>
	</defs>
	<path d="%s" fill="url(#piece)" stroke="rgba(255,255,255,.92)" stroke-width="2" filter="url(#edge)"/>
	</svg>`, sliderCaptchaPieceSize, sliderCaptchaPieceSize,
		color1, color2,
		puzzlePaths[puzzleIdx])
}

// ── Utilities ────────────────────────────────────────────────────

func svgDataURI(svg string) string {
	return "data:image/svg+xml," + strings.ReplaceAll(url.QueryEscape(svg), "+", "%20")
}

func randomInt(max int) (int, error) {
	if max <= 0 {
		return 0, nil
	}
	n, err := rand.Int(rand.Reader, big.NewInt(int64(max)))
	if err != nil {
		return 0, err
	}
	return int(n.Int64()), nil
}

func randomHex(bytesLen int) (string, error) {
	raw := make([]byte, bytesLen)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	return hex.EncodeToString(raw), nil
}
