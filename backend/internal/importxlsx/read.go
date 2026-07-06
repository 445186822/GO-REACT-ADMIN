package importxlsx

import (
	"archive/zip"
	"bytes"
	"encoding/xml"
	"fmt"
	"io"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

func Read(content []byte) ([][]string, error) {
	reader, err := zip.NewReader(bytes.NewReader(content), int64(len(content)))
	if err != nil {
		return nil, err
	}

	sharedStrings, err := readSharedStrings(reader)
	if err != nil {
		return nil, err
	}
	sheetPath, err := firstSheetPath(reader)
	if err != nil {
		return nil, err
	}
	file := findZipFile(reader, sheetPath)
	if file == nil {
		return nil, fmt.Errorf("worksheet %s not found", sheetPath)
	}
	return readWorksheet(file, sharedStrings)
}

func readSharedStrings(reader *zip.Reader) ([]string, error) {
	file := findZipFile(reader, "xl/sharedStrings.xml")
	if file == nil {
		return nil, nil
	}
	xmlFile, err := file.Open()
	if err != nil {
		return nil, err
	}
	defer xmlFile.Close()

	var doc struct {
		Items []struct {
			Text string `xml:"t"`
			Runs []struct {
				Text string `xml:"t"`
			} `xml:"r"`
		} `xml:"si"`
	}
	if err := xml.NewDecoder(xmlFile).Decode(&doc); err != nil {
		return nil, err
	}
	values := make([]string, 0, len(doc.Items))
	for _, item := range doc.Items {
		if item.Text != "" || len(item.Runs) == 0 {
			values = append(values, item.Text)
			continue
		}
		var builder strings.Builder
		for _, run := range item.Runs {
			builder.WriteString(run.Text)
		}
		values = append(values, builder.String())
	}
	return values, nil
}

func firstSheetPath(reader *zip.Reader) (string, error) {
	relsFile := findZipFile(reader, "xl/_rels/workbook.xml.rels")
	if relsFile == nil {
		return "xl/worksheets/sheet1.xml", nil
	}
	xmlFile, err := relsFile.Open()
	if err != nil {
		return "", err
	}
	defer xmlFile.Close()

	var rels struct {
		Relationships []struct {
			ID     string `xml:"Id,attr"`
			Type   string `xml:"Type,attr"`
			Target string `xml:"Target,attr"`
		} `xml:"Relationship"`
	}
	if err := xml.NewDecoder(xmlFile).Decode(&rels); err != nil {
		return "", err
	}
	for _, rel := range rels.Relationships {
		if strings.Contains(rel.Type, "/worksheet") && rel.Target != "" {
			target := strings.TrimPrefix(filepath.ToSlash(rel.Target), "/")
			if strings.HasPrefix(target, "xl/") {
				return target, nil
			}
			return filepath.ToSlash(filepath.Clean("xl/" + target)), nil
		}
	}
	return "xl/worksheets/sheet1.xml", nil
}

func readWorksheet(file *zip.File, sharedStrings []string) ([][]string, error) {
	xmlFile, err := file.Open()
	if err != nil {
		return nil, err
	}
	defer xmlFile.Close()
	data, err := io.ReadAll(xmlFile)
	if err != nil {
		return nil, err
	}

	var doc worksheet
	if err := xml.Unmarshal(data, &doc); err != nil {
		return nil, err
	}

	rows := make([][]string, 0, len(doc.SheetData.Rows))
	for _, xmlRow := range doc.SheetData.Rows {
		values := map[int]string{}
		maxColumn := -1
		for _, cell := range xmlRow.Cells {
			column := cellColumn(cell.Ref)
			if column < 0 {
				column = maxColumn + 1
			}
			value := cellValue(cell, sharedStrings)
			values[column] = value
			if column > maxColumn {
				maxColumn = column
			}
		}
		row := make([]string, maxColumn+1)
		for column, value := range values {
			row[column] = value
		}
		rows = append(rows, row)
	}
	return trimEmptyTrailingRows(rows), nil
}

type worksheet struct {
	SheetData struct {
		Rows []struct {
			Cells []cell `xml:"c"`
		} `xml:"row"`
	} `xml:"sheetData"`
}

type cell struct {
	Ref       string `xml:"r,attr"`
	Type      string `xml:"t,attr"`
	Value     string `xml:"v"`
	InlineStr struct {
		Text string `xml:"t"`
	} `xml:"is"`
}

func cellValue(cell cell, sharedStrings []string) string {
	switch cell.Type {
	case "s":
		index, err := strconv.Atoi(strings.TrimSpace(cell.Value))
		if err == nil && index >= 0 && index < len(sharedStrings) {
			return strings.TrimSpace(sharedStrings[index])
		}
	case "inlineStr":
		return strings.TrimSpace(cell.InlineStr.Text)
	}
	return strings.TrimSpace(cell.Value)
}

var cellRefPattern = regexp.MustCompile(`^([A-Za-z]+)`)

func cellColumn(ref string) int {
	match := cellRefPattern.FindStringSubmatch(ref)
	if len(match) != 2 {
		return -1
	}
	column := 0
	for _, char := range strings.ToUpper(match[1]) {
		column = column*26 + int(char-'A'+1)
	}
	return column - 1
}

func trimEmptyTrailingRows(rows [][]string) [][]string {
	last := len(rows) - 1
	for last >= 0 && rowIsEmpty(rows[last]) {
		last--
	}
	if last < 0 {
		return [][]string{}
	}
	return rows[:last+1]
}

func rowIsEmpty(row []string) bool {
	for _, value := range row {
		if strings.TrimSpace(value) != "" {
			return false
		}
	}
	return true
}

func findZipFile(reader *zip.Reader, name string) *zip.File {
	normalized := filepath.ToSlash(name)
	files := make([]*zip.File, 0, len(reader.File))
	files = append(files, reader.File...)
	sort.Slice(files, func(i, j int) bool { return files[i].Name < files[j].Name })
	for _, file := range files {
		if filepath.ToSlash(file.Name) == normalized {
			return file
		}
	}
	return nil
}
