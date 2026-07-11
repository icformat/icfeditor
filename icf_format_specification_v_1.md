# Indent Comma Format (ICF) Specification

Version 1.0
Status: Stable
---

# 1. Introduction

Indent Comma Format (ICF) is a compact hierarchical data serialization format designed to combine:

- the compactness of CSV,
- the readability of YAML,
- the hierarchy of JSON/XML,
- and the streaming capability of line-oriented formats.

ICF is especially suitable for:

- OCR extraction pipelines
- Invoice and ERP data interchange
- Document archival systems
- AI/RAG datasets
- Structured business documents
- Human-editable hierarchical records

ICF minimizes repeated keywords by defining schemas once and storing subsequent data positionally.

ICF was created by Edison Williams to export and import structured hierarchical data in a Document Management System software.

*(With help from ChatGPT for the specification and Claude Code for the icfj library)*

The proposed MIME type is 

```text
application/icf
```

The official website of ICF is https://icformat.org

---

# 2. Application

ICF is intended for structured hierarchical data where the schema is predefined and consistent.

ICF supports:

- Hierarchical structures
- Multiple structured rows under a node
- Compact positional storage
- Schema-driven parsing

Unlike JSON, XML, or YAML, ICF is intentionally schema-constrained.

ICF does not support arbitrary structural deviations inside records. All records are expected to follow the declared schema.

This restriction enables:

- Smaller file sizes
- Faster parsing
- Lower AI token usage
- Easier validation
- Efficient streaming
- Predictable data structures

ICF is therefore best suited for:

- Structured business documents
- OCR extraction pipelines
- Invoice archives
- ERP interchange
- AI/RAG datasets
- Repetitive hierarchical datasets

Formats such as JSON, XML, and YAML may still be more suitable when dealing with highly dynamic or irregular data structures.

---

## Design Goals

ICF is designed with the following goals:

- Human readable
- Compact storage
- Hierarchical structure support
- Minimal repeated field names
- Streamable append-friendly records
- AI-efficient token usage
- Easy parser implementation
- Schema-driven validation
- Git-friendly text representation

---

# 3. File Properties

Recommended extension:

```text
.icf
```

Example:

```text
invoice_archive.icf
```

The .icf extension is recommended but not required.

UTF-8 without BOM is recommended. 

---

# 4. File Structure

An ICF document may contain:

1. Metadata directives
2. Metadata section
3. Schema definitions
4. Master data section
5. Data section
6. Records

General structure:

```text
@version 1.0
@encoding utf-8
@delimiter comma
@escape backslash
@specification https://icformat.org/icf/specification/v1

@schema
...

@data
...
```

---

# 5. Metadata Directives

Metadata directives begin with `@`.

## Supported Directives

| Directive | Meaning |
|---|---|
| `@kind icf` | First line of ICF file
| `@specification` | URL of the official ICF specification document |
| `@schema-url` | URL of the schema definition used by the file |
| `@namespace` | Namespace identifier for the schema or domain. Namespace values are informational and do not affect parsing. |
| `@vendor` | Vendor or organization that generated the file |
| `@generator` | Software name and version that generated the file |
| `@created` | File creation timestamp |
| `@modified` | File edited timestamp |
| `@checksum` | File integrity checksum |
| `@hashmethod` | Optional checksum algorithm. Default is sha256. Other options are md5 and crc32. Libraries will have an extension point to add custom hash methods like crc32c and xxh3. |
| `@version` | ICF specification version |
| `@encoding` | Character encoding |
| `@delimiter` | Field delimiter |
| `@escape` | Escape character |
| `@records` | Total record count |
| `@schema` | Beginning of schema section |
| `@data` | Beginning of data section |
| `@record` | Beginning of a record |
| `@metadata` | User defined metadata |

Example:

```text
@kind icf
@version 1.0
@encoding utf-8
@delimiter comma
@escape backslash
@specification https://icformat.org/icf/specification/v1
@schema-url https://acmeocr.com/icf/schema/invoice-v1
@namespace com.acmeocr.invoice
@vendor Acme OCR Systems
@generator InvoiceExtractor 3.2.5
@created 2026-05-28T14:22:10Z
@checksum sha256:8f14e45fceea167a5a36dedd4bea2543
```

## Metadata Section

ICF supports an optional `@metadata` section for storing user-defined document metadata.

The `@metadata` section may contain arbitrary key-value pairs describing the ICF document.

Metadata is intended for descriptive information and does not affect schema validation, record processing, or data interpretation.

### Syntax

```text
@metadata

key: value
key: value
...
```

### Example

```text
@metadata

title: DMS Export
description: Data exported from Docuventa DMS
creator: Administrator
created: 2026-05-20T08:30:00Z
department: Accounts
company: ABC Constructions
```

### Rules

* The `@metadata` section is optional.
* Property names are case-sensitive.
* Property values are treated as strings.
* Applications may define additional metadata properties.
* Unknown properties should be ignored by parsers.
* The `@metadata` section shall appear before the first `@schema` definition.
* Metadata values do not participate in schema validation.

---

# 6. Indentation Rules

ICF uses indentation to represent hierarchy.

Recommended indentation:

```text
2 spaces
```

Tabs should be avoided.

Empty lines are ignored outside preformatted text blocks.

Empty lines may be used freely for readability outside preformatted text blocks.

Rules:

- Child nodes must be indented deeper than parent nodes.
- Sibling nodes must have the same indentation.
- Mixing tabs and spaces is not recommended.

---

# 7. Schema Definition

The schema defines:

- objects
- collections
- field ordering
- hierarchy

Example:

```text
@schema

customer:
  [CustomerID, Name, Phone]
```

## Multiple Schema Definitions

ICF supports multiple schema definitions within the same document.

Each schema shall be identified by a unique schema identifier.

### Syntax

```text
@schema id=<SchemaID>
```

### Example

```text
@schema id=Invoice

Invoice:
  [InvoiceNo, InvoiceDate, Amount]

@schema id=Vendor

Vendor:
  [VendorID, Name, Phone]
```

### Rules

* Schema identifiers must be unique within an ICF document.
* Schema identifiers are case-sensitive.
* Records may reference schemas using the `schema` record attribute.
* Applications should reject duplicate schema identifiers.

---

# 8. Objects

Objects are hierarchical structures.

Syntax:

```text
ObjectName:
```

Example:

```text
Project:
  [ProjectID, Location, Party]
```

---

# 9. Collections / Arrays

Collections contain multiple rows.

Syntax:

```text
CollectionName[]:
```

Example:

```text
BillItems[]:
  [SNo, Item, Quantity]
```

A single-row object uses the equals sign (=) before the value list.

A collection or array uses the hyphen sign (-) before each value list, indicating multiple entries.

```text
Single-row object:
  = value_1, value_2

Collection item:
  - value_a1, value_a2
  - value_b1, value_b2
  - value_c1, value_c2

```

---

# 10. Field Definitions

Field lists are enclosed in square brackets.

Syntax:

```text
[field1, field2, field3]
```

Example:

```text
filedata:
  [filename, extension, filesize]
```

---

## Example of hierarchical schema

```text
@schema

folderdata:
  [folderid, foldername]

filedata:
  [filename, extension, filesize, filehash]

indexdata:

  masterindex:
    [Project, Vendor]

    Project:
      [ProjectID, Location, Party]

    Vendor:
      [VendorID, Phone, Email]

  documentindex:
    [InvoiceNo, InvoiceDate, Delivery, Payment]

  lineindex:
    [BillItems, GSTDetails]

    BillItems[]:
      [SNo, Item, Quantity, Units, Rate, Discount, Amount]

    GSTDetails[]:
      [SNo, GSTType, GSTRate, GSTAmount]
```

---

# 11. Data Records

Each record begins with:

```text
@record
```

Example:

```text
@record

customer:
  = C001, John, 9876543210
```

## Record Attributes

ICF supports optional record attributes for indexing, identification, debugging, synchronization, and random-access optimization.

Record attributes are specified on the same line as the `@record` directive.

### Syntax

```text
@record key=value key=value
```

### Examples

```text
@record id=D001

@record uuid=550e8400-e29b-41d4-a716-446655440000 revision=2

@record id=D001 revision=3 created=2026-05-01T09:15:00Z modified=2026-05-28T18:42:15Z
```

### Reserved Record Attributes

| Attribute  | Meaning                                  |
| ---------- | ---------------------------------------- |
| `id`       | Logical record identifier                |
| `uuid`     | Globally unique record identifier        |
| `created`  | Record-level initial timestamp           |
| `modified` | Record-level last modification timestamp |
| `revision` | Record-level revision number             |

### User-Defined Attributes

Users may define additional custom attributes.

Example:

```text
@record id=D001 tenant=SouthBranch region=TN
```

### Attribute Rules

* Attributes must be specified as `key=value` pairs.
* Multiple attributes are separated by spaces.
* Attribute names are case-sensitive.
* Attribute values are treated as strings.
* Unescaped whitespace is not allowed inside attribute values.
* Leading and trailing whitespace around attribute names and values should be ignored.
* Escaped whitespace is permitted using the escape character.

Example:

```text
@record id=D001 note=South\ Zone
```

Parsed value:

```text
South Zone
```

## Record Schema Association

When multiple schemas are present, records shall identify the schema used for interpretation.

### Syntax

```text
@record schema=<SchemaID> id=<RecordID>
```

### Example

```text
@record schema=Invoice id=INV001

Invoice:
  = INV001, 2026-05-01, 10000
```

```text
@record schema=Vendor id=VEN001

Vendor:
  = VEN001, ABC Traders, 9876543210
```

### Rules

* The `schema` attribute identifies the schema definition used by the record.
* The referenced schema identifier must exist within the document.
* Schema identifiers are case-sensitive.
* Records without a schema attribute are interpreted using the document's default schema when one exists.
* When multiple schemas are defined, the `schema` attribute should be specified.

---

### Record Revisions

Record revisions are independent of file revisions.

Example:

```text
@record id=D001 revision=3
```

Revision values SHALL be positive integers greater than zero and SHOULD increase monotonically whenever the record contents change.

### Record Attribute Semantics

Record attributes are metadata only.

They do **not**:

* alter schema hierarchy
* affect field ordering
* modify parsing rules
* change record structure

---


# 12. Row Markers

Rows begin with the equals symbol.

Syntax:

```text
= value1, value2, value3
```

Example:

```text
Project:
  = PRJ001, Coimbatore, ABC Constructions
```

## Compact Object Syntax

A single-row object may be written in compact form.

Example:

Vendor:VEN001, ABC Traders, Coimbatore

is equivalent to:

Vendor:
  = VEN001, ABC Traders, Coimbatore

Compact object syntax is equivalent to a single-row object (= marker).

### Rules:

- No whitespace is permitted before the colon.
- Parsers shall treat both forms identically.

---

# 13. Master Data

ICF supports optional master data sections for storing reusable structured data that may be referenced by records.

Master data is intended to reduce duplication and improve import/export efficiency when working with relational or document-oriented databases.

Typical master data entities include:

* Vendors
* Customers
* Projects
* Employees
* Departments
* Document Types
* Categories
* Status Codes

Master data is defined once and may be referenced multiple times by records within the same ICF document.

## Master Data Schema

Master data structures shall be declared in the schema section.

Example:

```text
@schema

masters:

  Vendor[]:
    [VendorID, Name, Phone]

  Project[]:
    [ProjectID, Location, Party]
```

## Master Data Section

Master data is declared using the `@masters` directive.

Applications may use the master type to resolve the reference within the appropriate master data collection.

Example:

```text
@masters

Vendor:
  - VEN001, ABC Traders, 9876543210
  - VEN002, XYZ Suppliers, 9988776655

Project:
  = PRJ001, Coimbatore, ABC Constructions
```

## Referencing Master Data

A master data reference uses the format:

```text
MasterType:MasterID
```

Examples:

```text
documentindex:
  = INV001, Vendor:VEN001, Project:PRJ001
```

The value before the colon identifies the master data type.

The value after the colon identifies the master record.

In this example:

* `Vendor:VEN001` references the Vendor master record with identifier `VEN001`.
* `Project:PRJ001` references the Project master record with identifier `PRJ001`.

## Master Data Rules

* Master data is optional and can be used for large repeating data to make the file smaller.
* The `@masters` section, if present, shall appear after `@schema` and before `@data`.
* Multiple master data entries of the same type are permitted.
* Master data entries shall conform to the schema definition.
* The first field declared in a master schema SHALL be the master record identifier.
* For collection masters, the identifier SHALL be unique within that collection.
* References to master data are not enforced by the ICF format itself.
* Validation tools may verify the existence of referenced master data entries.
* Master Data sacrifices streaming capability to an extent for smaller file size.


## Processing Order

When importing an ICF file, applications should process sections in the following order:

```text
@schema
@masters
@data
```

This allows master data to be loaded before records that reference it.

An example of the recommended order of the directives is given below

```text
@kind icf

@version
@encoding
@delimiter
@escape

@specification
@schema-url
@namespace
@vendor
@generator

@created
@modified
@revision
@checksum

@index

@metadata

@schema ...

@masters

@data
```

## Example

```text
@schema

masters:

  Vendor[]:
    [VendorID, Name, Phone]

  Project:
    [ProjectID, Location, Party]

Invoice:
  [InvoiceNo, VendorID, ProjectID]

@masters

Vendor:
  - VEN001, ABC Traders, 9876543210
  - VEN002, XYZ Suppliers, 9988776655

Project:
  = PRJ001, Coimbatore, ABC Constructions

@data

@record id=INV001

Invoice:
  = INV001, VEN001, PRJ001

@record id=INV002

Invoice:
  = INV002, VEN002, PRJ001
```

## Benefits

Master data provides:

* Reduced file size
* Reduced duplication
* Faster database imports
* Improved data consistency
* Better representation of relational data structures
* Smaller AI token footprints

Master data is particularly beneficial when exporting and importing large datasets from database-backed applications such as Document Management Systems, ERP systems, and OCR processing platforms.

---

# 14. Escaping Rules

ICF uses the backslash (`\\`) as the escape character.

## Characters That Must Be Escaped

| Character | Escape Sequence | Reason |
|---|---|---|
| `,` | `\\,` | Field delimiter |
| `\\` | `\\\\` | Escape character itself |
| `[` | `\\[` | Schema delimiter |
| `]` | `\\]` | Schema delimiter |
| `:` | `\\:` | Object separator |
| `=` | `\\=` | Row marker |
| `@` | `\\@` | Directive marker |
| `#` | `\\#` | Reserved for future comments |
| Newline | `\\n` | Embedded multiline data |
| Tab | `\\t` | Embedded tab character |
| Carriage Return | `\\r` | Cross-platform compatibility |

---

## Escaping Examples

### Comma Escaping

```text
= VEN001, ABC Traders\\, South Zone, 9876543210
```

Parsed value:

```text
ABC Traders, South Zone
```

### Backslash Escaping

```text
= C:\\\\Invoices\\\\April
```

Parsed value:

```text
C:\Invoices\April
```

### Colon Escaping

```text
= Delivery\\: Immediate
```

Parsed value:

```text
Delivery: Immediate
```

---

# 15. Empty Values

Empty values are allowed.

Example:

```text
= VEN001, , vendor@example.com
```

This represents:

```text
Phone = empty
```

Empty values also help in converting from formats that do not have fixed structure such as YAML to ICF. All possible keywords are created in the schema and empty values are used in the records when not available. When converting from ICF to a flexible format like YAML or XML, the empty values are stripped away.

---

# 16. Null Values

Recommended null representation:

```text
null
```

Example:

```text
= VEN001, null, vendor@example.com
```

---

# 17. Comments (Reserved)

Future versions may support comments.

Recommended reserved syntax:

```text
# comment
```

Since `#` is reserved, literal `#` characters should be escaped.

Example:

```text
Invoice\\#001
```

---

# 18. Multiline Data

Embedded multiline data should use escaped newline sequences.

Example:

```text
= "Line1\\nLine2\\nLine3"
```

Parses as:

```text
Line1
Line2
Line3
```

## Preformatted Text Blocks

ICF supports user-defined preformatted text blocks for storing unstructured content such as:

* OCR output
* Notes
* Email bodies
* HTML fragments
* JSON fragments
* SQL scripts
* Markdown
* Log files
* Large text (CLOB) fields

Text blocks preserve all content exactly as written.

No escaping is required within a text block.

### Syntax

A text block begins with:

```text
<<TAG
```

and ends with:

```text
TAG>>
```

where `TAG` is a user-defined identifier.

The opening and closing tags must match exactly.

### Example

```text
OCRText:

  <<TEXT
  Invoice No: INV-2026-001

  Vendor: ABC Traders

  Total Amount: Rs. 84,500

  @record
  Vendor:VEN100
  # Comment

  These are treated as ordinary text.
  TEXT>>
```

### HTML Example

```text
EmailBody:

  <<HTML
  <html>
    <body>
      <h1>Invoice</h1>
      <p>Total Amount: Rs. 84,500</p>
    </body>
  </html>
  HTML>>
```

### JSON Example

```text
Configuration:

  <<JSON
  {
    "host": "localhost",
    "port": 5432
  }
  JSON>>
```

### Rules

* Tags are case-sensitive.
* Opening and closing tags must match exactly.
* All content between the tags shall be preserved verbatim.
* Whitespace shall be preserved exactly.
* Empty lines are ignored outside text blocks and preserved inside text blocks.
* No escaping is required within a text block.
* Reserved ICF characters have no special meaning inside a text block.
* Directives, comments, references, and schema elements appearing inside a text block shall be treated as ordinary text.
* Applications shall not attempt to parse the contents of a text block unless explicitly requested by the application.

### Supported Characters

A text block may contain:

* Commas
* Colons
* Semicolons
* Single quotes
* Double quotes
* Backslashes
* Hash characters (`#`)
* At symbols (`@`)
* Square brackets
* Curly braces
* Angle brackets
* Unicode characters
* Line breaks
* Tabs

without escaping.

### Parsing Semantics

Upon encountering a text block opening tag:

```text
<<TAG
```

the parser shall:

1. Read all subsequent lines without interpretation.
2. Preserve all characters exactly as written.
3. Continue until a matching closing tag:

```text
TAG>>
```

is encountered.

The contents of the block shall be returned as a single text value.

### Tag Matching Rules

For a text block to terminate successfully:

1. The opening and closing tags must contain the same tag identifier.
2. Tag matching is case-sensitive.
3. The opening and closing tags must use the same indentation level.
4. The opening tag must appear alone on its line.
5. The closing tag must appear alone on its line.

Example:

```text
OCRText:

  <<TEXT
  Line 1
  Line 2
  TEXT>>
```

Valid because:

* Opening tag is `TEXT`
* Closing tag is `TEXT>>`
* Indentation matches
* Both tags occupy their own lines

Example:

```text
OCRText:

  <<TEXT
  Line 1
    TEXT>>
```

Invalid because the closing tag indentation differs from the opening tag.

Example:

```text
OCRText:

  <<TEXT
  Line 1
  text>>
```

Invalid because tag matching is case-sensitive.

Example:

```text
OCRText:

  <<TEXT extra
  Line 1
  TEXT>>
```

Invalid because the opening tag does not occupy its own line.

### Indentation Preservation

All content between the opening and closing tags shall be preserved exactly as written, including:

* Leading whitespace
* Trailing whitespace
* Blank lines
* Tabs
* Unicode characters

The parser shall not modify indentation within the text block.

### Parsing Algorithm

When a parser encounters:

```text
<<TAG
```

at indentation level `N`, it shall:

1. Record the tag name and indentation level.
2. Read all subsequent lines verbatim.
3. Continue until a line containing:

```text
TAG>>
```

with the same indentation level `N` is encountered.
4. Return all intervening content as a single text value.
5. Preserve all characters exactly as stored.

### Intended Use

Preformatted text blocks are intended for storing unstructured content alongside structured ICF data while preserving formatting and readability.

### Security Considerations

ICF text blocks store content verbatim and do not interpret or validate the contents.

Text blocks may contain:

* HTML
* JavaScript
* SQL
* JSON
* XML
* Markdown
* Executable code
* Arbitrary user-supplied content

Applications processing ICF files shall treat text block contents as untrusted input.

Applications should:

* Validate content before execution.
* Sanitize content before rendering in web browsers.
* Avoid executing code contained in text blocks unless explicitly intended.
* Apply appropriate security controls based on the content type.

The ICF format itself does not define execution semantics for text blocks.

---

# 19. Checksum and Revision Semantics

## File Revision

The `@revision` directive represents the revision number of the ICF file.

Example:

```text
@revision 15
```

The revision number should be incremented whenever:

- Schema definitions change
- Data records change
- Records are added or removed
- Metadata changes


## File Checksum

The file-level checksum should be calculated from the canonical representation of the:

- `@schema` section
- `@masters` section (if present)
- `@data` section

The following metadata should be excluded from checksum calculation:

- `@checksum`
- `@modified`
- `@revision`

 The checksum algorithm is governed by `@hashmethod` and values carry a `method:` prefix.

```text
@hashmethod crc32:...
```

The default method is `sha256`.

## Schema Checksum

Implementations may optionally support:

```text
@schema-checksum sha256:...
```

A schema checksum is calculated only from the `@schema` section. Schema checksums are ideally placed in the ICX file.

## Canonical Representation

To ensure consistent checksums across implementations, checksums should be calculated using:

- UTF-8 encoding
- LF (`\\n`) line endings
- Normalized indentation
- Exclusion of checksum fields themselves

---
# 20. Example Full Document

```text
@kind icf

@version 1.0
@encoding utf-8
@delimiter comma
@escape backslash

@specification https://icformat.org/specification/v1
@schema-url https://docuventa.com/schema/dms-export-v1

@namespace com.docuventa.export
@vendor Docuventa
@generator Docuventa Export Engine 1.0

@created 2026-05-20T08:30:00Z
@modified 2026-05-20T08:30:00Z
@revision 1

@records 3

@index dms_export.icx

@metadata

title: DMS Export
description: Mixed document export from Docuventa DMS
creator: Administrator

@schema id=Masters

Vendor[]:
  [VendorID, Phone, Email]

Project[]:
  [ProjectID, Location, Party]

@schema id=Invoice

folderdata:
  [folderid, documentid]

filedata:
  [filename, extension, filesize, filehash]

documentindex:
  [InvoiceNo, InvoiceDate, Delivery, Payment, VendorRef, ProjectRef]

lineindex:

  BillItems[]:
    [SNo, Item, Quantity, Units, Rate, Discount, Amount]

  GSTDetails[]:
    [SNo, GSTType, GSTRate, GSTAmount]

@masters

Vendor:
  - VEN100, 9876543210, vendor@example.com
  - VEN200, 9898989898, vendor2@example.com
  - VEN501, 9988776655, vendor3@example.com

Project:
  - PRJ001, Coimbatore, ABC Constructions
  - PRJ005, Tiruppur, Delta Infra
  - PRJ010, Salem, Metro Logistics

@data

@record schema=Invoice id=DOC1001 uuid=550e8400-e29b-41d4-a716-446655440001 created=2026-05-01T10:00:00Z modified=2026-05-15T16:30:00Z revision=1

folderdata:
  = F001, DOC1001

filedata:
  = invoice_apr, pdf, 245120, SHA256_A1B2C3

documentindex:
  = INV-2026-001, 2026-05-01, Immediate, 30 Days, Vendor:VEN100, Project:PRJ001

lineindex:

  BillItems:
    - 1, Cement, 100, Bags, 420, 0, 42000
    - 2, Steel Rod, 50, Nos, 850, 0, 42500

  GSTDetails:
    - 1, IGST, 18, 7650
    - 2, IGST, 12, 5040

@record schema=Invoice id=DOC2001 uuid=550e8400-e29b-41d4-a716-446655440002 created=2026-05-10T09:00:00Z modified=2026-05-20T11:15:00Z revision=2

folderdata: 
  = F002, DOC2001

filedata: 
  = vendor_bill, pdf, 310220, SHA256_X9Y8Z7 
  
documentindex:
  = INV-2026-002, 2026-05-10, Scheduled, Advance, Vendor:VEN501, Project:PRJ005 
  
lineindex: 

  BillItems: 
    - 1, Paint, 120, Litres, 310, 500, 36700
    - 2, Primer, 60, Litres, 250, 0, 15000 
  
  GSTDetails: 
    - 1, CGST, 9, 3303 
    - 2, SGST, 9, 3303 
    
@record schema=Invoice id=DOC3001 uuid=550e8400-e29b-41d4-a716-446655440003 created=2026-05-20T08:30:00Z modified=2026-05-25T14:45:00Z revision=1 

folderdata: 
  = F003, DOC3001 
  
filedata: 
  = transport_invoice, pdf, 185900, SHA256_QWER1234 
    
documentindex: 
  = INV-2026-003, 2026-05-20, Partial, 15 Days, Vendor:VEN501, Project:PRJ010 
  
lineindex: 
  
  BillItems: 
    - 1, Diesel, 500, Litres, 92, 0, 46000 
    - 2, Lubricant, 20, Cans, 850, 200, 16800 
      
  GSTDetails: 
    - 1, IGST, 18, 11304
```

---

# 21. Conformance

An implementation claiming compliance with ICF 1.0 SHALL:

* Support UTF-8 encoded ICF documents.
* Support all mandatory metadata directives defined by this specification.
* Support schema definitions.
* Support object definitions.
* Support collection definitions.
* Support row markers (`=` and `-`).
* Support data records.
* Support record attributes.
* Support master data sections.
* Support compact object syntax.
* Support escaping rules.
* Support preformatted text blocks.
* Preserve field ordering as defined by the schema.
* Preserve collection ordering.

An implementation MAY provide additional features provided they do not violate the semantics defined by this specification.

---

# 22. Reserved Future Directives

Directive names beginning with `@` that are not defined by this specification are reserved for future versions of ICF or application-specific extensions.

Examples:

```text
@import
@signature
@encryption
@binary
```

Parsers SHOULD ignore unknown directives unless strict validation mode is enabled.

Applications MAY define custom directives for internal use.

To avoid naming conflicts, application-specific directives SHOULD use namespaces.

Namespace segments SHOULD be separated using the period (`.`) character.

Examples:

```text
@docuventa.cache
@acme.signature
@example.encryption
```

Applications SHOULD use namespace identifiers that are unlikely to conflict with future ICF standard directives.

The use of namespaces does not imply any special processing semantics and is intended solely to reduce naming collisions between independent implementations.

---

# 23. Version Compatibility Guidance

ICF versions use the format:

```text
Major.Minor
```

Examples:

```text
1.0
1.1
2.0
```

Version compatibility rules:

* A change in the Major version indicates a potentially incompatible format change.
* A change in the Minor version indicates a backward-compatible enhancement.
* Implementations encountering a higher Major version SHOULD reject the file.
* Implementations encountering a higher Minor version MAY continue processing while ignoring unsupported features.
* Unknown directives SHOULD be ignored unless strict validation is enabled.
* Unknown metadata properties SHOULD be ignored.

Example:

```text
@version 1.1
```

An ICF 1.0 parser may continue processing the document while ignoring unsupported features introduced in version 1.1.

---

# 24. Parser Recommendations

ICF parsers should:

* Validate indentation consistency.
* Validate field counts.
* Support streaming reads.
* Preserve collection ordering.
* Support UTF-8 fully.
* Handle escaped delimiters correctly.
* Ignore trailing whitespace.
* Ignore a UTF-8 BOM if present.
* Provide meaningful validation errors.
* Support schema-driven validation.
* Support partial record processing for large files.
* Preserve text block contents exactly as stored.

Parsers should avoid modifying data unless explicitly requested by the application.

---

# 25. Recommended Future Extensions

Potential future enhancements:

* Data types
* Schema inheritance
* Includes/imports
* Binary ICF
* Compression
* Digital signatures
* Schema references

Example future type syntax:

```text
InvoiceDate:date
Amount:decimal(10,2)
```

Future versions may also introduce:

* Record-level digital signatures
* Encrypted sections
* External schema repositories
* Incremental update files
* Binary transport representations

---

# 26. Copyright and License

Copyright (c) 2026 Edison Williams.

This specification is licensed under the Creative Commons Attribution 4.0 International License (CC BY 4.0).

You are free to:

* Share — copy and redistribute this specification in any medium or format.
* Adapt — remix, transform, and build upon this specification for any purpose, including commercial purposes.

Under the following terms:

* Attribution — You must give appropriate credit, provide a link to the license, and indicate if changes were made.

License:

https://creativecommons.org/licenses/by/4.0/

---

# 27. Summary

ICF combines:

* CSV compactness
* YAML readability
* Hierarchical organization
* Schema-driven parsing
* Streamable records

while minimizing repeated field names and token overhead.

ICF is particularly suitable for:

* Business document processing
* OCR pipelines
* AI/RAG systems
* Invoice archives
* ERP interchange
* Hierarchical structured datasets

---