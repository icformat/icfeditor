# Create an ICF Editor

I am creating a desktop editor for the Indent Comma Format (ICF) and its associated index format (ICX).

I will provide:

* ICF 1.0 specification
* ICX 1.0 specification
* Existing documentation
* Existing ICF libraries and tools

Build a professional cross-platform desktop application using:

* TypeScript
* React
* Electron
* Monaco Editor
* Tailwind CSS

The application should support dark mode.

---

# Overall Architecture

Use:

```text
src/

main/
renderer/

components/
panels/
dialogs/
services/
models/
commands/
hooks/
utils/
validators/

tests/
```

Follow MVVM principles.

Keep UI and parser logic separate.

Design everything to be extensible.

---

# File Support

Support:

* .icf
* .icx

Multiple documents may be opened simultaneously.

---

# Main UI

The UI should resemble VS Code.

Include:

* Menu bar
* Toolbar
* Tree panel
* Main editor
* Properties panel
* Validation panel
* Search panel
* Status bar

---

# Modes

Provide:

## View Mode

Read-only.

Record navigation optimized.

Collapsible sections.

## Edit Mode

Full editing.

Undo/redo.

Save.

Save As.

---

# Collapsible Sections

Allow collapse and expand of:

* @metadata
* each @schema
* @masters
* individual master collections
* @data
* every @record

State should persist while the file is open.

---

# Record Navigation

Implement record-wise scrolling.

Shift + mouse wheel should move by record.

Each small wheel movement should place the next record at the top.

Keyboard shortcuts:

Ctrl+Up

Ctrl+Down

Previous Record

Next Record

Go To Record

---

# Tree View

Show:

Metadata

Schemas

Masters

Data

Record nodes

Record IDs

Schema names

Icons for:

Metadata

Schema

Master

Record

Warning

Error

---

# Search

Support:

## Text search

Search all text.

## Record ID search

Jump directly to:

@record id=...

## UUID search

## Schema search

## Full text search

Display matching records.

Highlight matches.

---

# Record Filters

Allow filtering by:

Schema

Examples:

Invoice

Vendor

Masters

Typing:

Invoice

should only display records with:

@record schema=Invoice

Multiple schema selections should be supported.

---

# Record Information Panel

Display:

Record ID

UUID

Schema

Created

Modified

Revision

Checksum

Validation status

---

# ICF Validation

Implement:

Schema validation

Field count validation

Reference validation

Master reference validation

Duplicate ID detection

Duplicate UUID detection

Directive validation

Indentation validation

Text block validation

Checksum validation

Display:

Errors

Warnings

Information

Clicking a validation item should jump to the corresponding record.

---

# ICX Support

Generate ICX from ICF.

View ICX.

Regenerate ICX.

Compare ICF and ICX.

Verify:

@revision

@sourcerevision

Checksums

Record counts

Display missing or stale indexes.

---

# Merge ICF Files

Merge multiple ICF files when schemas are compatible.

Merge:

Metadata

Schemas

Masters

Records

Remove duplicate master records.

Detect conflicts.

Allow preview before merge.

---

# Split ICF Files

Split by:

Record range

Example:

100-500

Split by:

Schema

Split by:

Number of records

Split by:

Maximum file size

---

# Export

Support:

ICF

ICX

JSON

CSV

XML

YAML

Pretty JSON

Compact JSON

---

# Tips Panel

Include an optional panel showing:

Keyboard shortcuts

Examples

Best practices

Recent operations

---

# Record Viewer

Show one record at a time.

Previous/Next buttons.

Tree view for:

Objects

Collections

Text blocks

References

---

# Statistics

Display:

Number of schemas

Number of masters

Number of records

File size

Record size distribution

Revision

Creation date

Modification date

---

# Editor Features

Undo

Redo

Copy

Paste

Cut

Duplicate Record

Delete Record

Insert Record

Clone Record

Move Record Up

Move Record Down

Find

Replace

Go To Record

Bookmarks

Recent files

Autosave

---

# Keyboard Shortcuts

Ctrl+S

Ctrl+Z

Ctrl+Y

Ctrl+F

Ctrl+H

Ctrl+G

Ctrl+Shift+M

Ctrl+Shift+V

F5 regenerate ICX

F6 validate

F7 previous record

F8 next record

---

# Themes

Support:

Light

Dark

System

---

# Help

Include:

About dialog

Specification links

Tool links

Documentation links

Keyboard shortcuts

Tutorial

---

# Internal Services

Create services:

ICFParserService

ICFWriterService

ICFValidatorService

ICXGeneratorService

ICXParserService

SearchService

MergeService

SplitService

StatisticsService

ExportService

UndoService

SettingsService

---

# Tests

Create unit tests for:

Parser

Writer

Validator

ICX generator

Search

Merge

Split

Statistics

Use Vitest.

---

# Packaging

Package for:

Windows

Linux

macOS

Create installers.

---

# Performance

Support files containing:

100,000+ records

Lazy loading.

Virtual scrolling.

Background validation.

Avoid loading everything into the UI at once.

---

# Code Quality

Use:

TypeScript strict mode.

Interfaces.

Dependency injection.

No duplicated logic.

Meaningful comments.

Professional naming.

Maintainable architecture.

Generate complete source code with documentation and tests.

# References

ICF and ICX specifications live at ../icfj/icf_format_specification_v_1.md and ../icfj/icx_index_specification_v_1.md
The HTML version is at https://icformat.org/icf/specification/v1/ and https://icformat.org/icx/specification/v1/

The library for Java resides in Maven as icfj and can be loaded with
`<dependency>
    <groupId>org.icformat</groupId>
    <artifactId>icfj</artifactId>
    <version>1.0.0</version>
</dependency>`
in pom.xml

The python licrary can be loaded with pip install icfpy

The Javascript library is at ../icf.js/
It can also be found at https://github.com/icformat/icf.js

The specifications are detailed in https://icformat.org

