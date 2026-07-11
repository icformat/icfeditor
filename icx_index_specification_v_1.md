# Indent Comma Index Format (ICX) Specification

Version 1.0

---

# 1. Introduction

Indent Comma Index Format (ICX) is an optional companion format to ICF.

An ICX file contains indexing and optimization metadata for records stored in an ICF file.

ICX is designed to support:

* Random record access
* Fast record lookup
* Record integrity verification
* Synchronization
* Incremental processing
* Large ICF archives

ICX contains only index information and does not store business data.

---

# 2. File properties

Recommended extension:

```text
.icx
```

Example:

```text
invoice_archive.icx
```

The .icx extension is recommended but not required.

The proposed MIME type is

```text
application/icx
```

UTF-8 without BOM is recommended. 

---

# 3. Relationship to ICF

An ICF file may reference an ICX file using:

```text
@index invoice_archive.icx
```

The referenced ICX file contains indexing information for records contained within the ICF document.

ICX files are optional.

Applications must continue to function when an ICX file is absent.

---

# 4. Metadata Directives

Metadata directives begin with `@`.

## Supported Directives

| Directive   | Meaning                                     |
| ----------- | ------------------------------------------- |
| `@kind icx` | First line of ICX file                      |
| `@version`  | ICX specification version                   |
| `@created`  | Index creation timestamp                    |
| `@modified` | Last index modification timestamp           |
| `@revision` | Index revision number                       |
| `@source`   | Associated ICF file                         |
| `@sourcerevision` | ICF revision number of file from which ICX was generated |
| `@checksum` | File integrity checksum                     |
| `@sourcechecksum` | Content checksum of ICF file, excluding ICF metadata. Same value as `checksum` in ICF file |
| `@sourcefilechecksum` | Full file checksum of ICF including ICF metadata |
| `@hashmethod` | Optional checksum algorithm. Default is sha256. Other options are md5 and crc32. Libraries will have an extension point to add custom hash methods like crc32c and xxh3. Use same hash method, if specified in ICF |
| `@records`  | Record count (Only @data, not @masters)     |
| `@schema`   | Beginning of schema definition              |
| `@masters`  | Beginning of master data index definitions  |
| `@data`     | Beginning of regular data index definitions |

Example:

```text
@kind icx
@version 1.0
@created 2026-05-28T14:22:10Z
@modified 2026-05-29T10:15:42Z
@revision 3
@source invoice_archive.icf
@sourcerevision 5
@checksum sha256:ICX_CONTENT_HASH
@sourcechecksum sha256:ICX_CONTENT_HASH
@sourcefilechecksum sha256:ICX_FILE_HASH
@records 250
```

---

# 5. Index Schema

The default index structure is:

```text
@schema

index:
  [RecordID, UUID, Line, Offset, Size, Checksum]
```

Field meanings:

| Field    | Meaning              |
| -------- | -------------------- |
| RecordID | Record identifier    |
| UUID     | Record UUID          |
| Line     | Starting line number |
| Offset   | Starting byte offset |
| Size     | Record size in bytes |
| Checksum | Record checksum      |

---
For more complex ICF files with multiple masters and corresponding data we would have

### Master Index Definitions

```text
@masters

  Vendor:
    [RecordID, UUID, Line, Offset, Size, Checksum]

  Project:
    [RecordID, UUID, Line, Offset, Size, Checksum]

  Customer:
    [RecordID, UUID, Line, Offset, Size, Checksum]
```

### Data Index Definitions

```text
@data

  Invoice:
    [RecordID, UUID, Line, Offset, Size, Checksum]

  GoodsReceipt:
    [RecordID, UUID, Line, Offset, Size, Checksum]

  EWayBill:
    [RecordID, UUID, Line, Offset, Size, Checksum]
```

Since the master index and the data index have the same structure, all master and data index collections implicitly use the common ```index[]``` array structure.

```text
@schema

index[]:
  [RecordID, UUID, Line, Offset, Size, Checksum]
```

This is the preferred format for index schema.

---

# 6. Index Data

Example:

```text
@masters

  Vendor:
    - VEN001,550e8400-e29b-41d4-a716-446655440000,25,285,120,sha256:ABC123
    - VEN002,550e8400-e29b-41d4-a716-446655440001,30,405,118,sha256:ABC124

  Project:
    - PRJ001,550e8400-e29b-41d4-a716-446655440002,40,620,85,sha256:DEF456

@data

  Invoice:
    - INV001,550e8400-e29b-41d4-a716-446655440003,80,1400,420,sha256:GHI789
    - INV002,550e8400-e29b-41d4-a716-446655440004,95,1820,398,sha256:GHI790
```

---

# 7. Checksum Semantics

The checksum algorithm is governed by `@hashmethod` and values carry a `method:` prefix.

Example:
```text
@hashmethod crc32:...
```

The default method is `sha256`.

Checksums are calculated from the corresponding ICF record contents.

For regular records:

* Record body is included.
* `@record` directive is excluded.
* Record attributes are excluded.

For master records:

* Master data row contents are included.
* Structural directives are excluded.

Checksums should be calculated using:

* UTF-8 encoding
* LF line endings
* Canonical field ordering

---

# 8. Line and Offset Semantics

Line numbers and byte offsets are advisory indexing information.

Applications must not rely on them for correctness.

If the associated ICF file is modified, the ICX file should be regenerated.

---

# 9. Revision Semantics

The `@revision` value shall be a positive integer.

The revision number should increase whenever:

* Records are added
* Records are removed
* Record locations change
* Checksums change
* Master data changes
* Index metadata changes

---

# 10. Example Full ICX File

```text
@kind icx

@version 1.0
@created 2026-05-20T08:30:00Z
@modified 2026-05-25T14:45:00Z
@revision 3
@source dms_export.icf
@sourcerevision 5

@records 3

@schema

index[]:
  [RecordID, UUID, Line, Offset, Size, Checksum]

@masters

  Vendor:
    - VEN100,,53,1120,58,sha256:VEND100HASH
    - VEN501,,56,1185,59,sha256:VEND501HASH
    - VEN800,,59,1250,59,sha256:VEND800HASH

  Project:
    - PRJ001,,63,1340,62,sha256:PROJ001HASH
    - PRJ005,,66,1410,56,sha256:PROJ005HASH
    - PRJ010,,69,1470,59,sha256:PROJ010HASH

@data

  Invoice:
    - DOC1001, 550e8400-e29b-41d4-a716-446655440001, 75, 1600, 980, sha256:DOC1001HASH
    - DOC2001, 550e8400-e29b-41d4-a716-446655440002, 110, 2580, 920, sha256:DOC2001HASH
    - DOC3001, 550e8400-e29b-41d4-a716-446655440003, 145, 3500, 870, sha256:DOC3001HASH
```

