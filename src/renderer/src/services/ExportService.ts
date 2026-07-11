import type { IcfDocument } from 'icf.js'
import type { ICFWriterService } from './ICFWriterService'
import type { ICXGeneratorService } from './ICXGeneratorService'
import type { ExportFormat, ExportResult } from '../models/export'

type Json = string | number | boolean | null | Json[] | { [key: string]: Json }

/** Optional context for export (the source file name + text drive ICX positions). */
export interface ExportOptions {
  sourceFileName?: string
  sourceText?: string
}

/**
 * Exports a document to the formats in Prompt.md §Export. ICF/ICX go through
 * the `icf.js` writer/generator; JSON/CSV/XML/YAML are derived from the
 * document's native JSON tree (`toJsonString`). The lightweight CSV/XML/YAML
 * emitters cover the common record shapes; deeply nested values are preserved
 * as embedded JSON in a cell/attribute.
 *
 * Async because the ICX export computes checksums (Web Crypto) and positional
 * fields for both records and masters (see {@link ICXGeneratorService.generateFull}).
 */
export class ExportService {
  constructor(
    private readonly writer: ICFWriterService,
    private readonly icx: ICXGeneratorService
  ) {}

  async export(
    doc: IcfDocument,
    format: ExportFormat,
    options: ExportOptions = {}
  ): Promise<ExportResult> {
    switch (format) {
      case 'icf':
        return { format, extension: 'icf', content: this.writer.write(doc) }
      case 'icx': {
        // Fully-populated index: Line/Offset/Size/Checksum (+ UUID) for records
        // and masters, so the exported ICX is complete rather than a skeleton.
        const icx = await this.icx.generateFull(doc, options)
        return { format, extension: 'icx', content: this.writer.write(icx) }
      }
      case 'json':
      case 'jsonPretty':
        return { format, extension: 'json', content: doc.toPrettyString() }
      case 'jsonCompact':
        return { format, extension: 'json', content: doc.toJsonString() }
      case 'csv':
        return { format, extension: 'csv', content: this.toCsv(this.asJson(doc)) }
      case 'xml':
        return { format, extension: 'xml', content: this.toXml(this.asJson(doc)) }
      case 'yaml':
        return { format, extension: 'yaml', content: this.toYaml(this.asJson(doc)) }
    }
  }

  private asJson(doc: IcfDocument): Json {
    return JSON.parse(doc.toJsonString()) as Json
  }

  // --- CSV ------------------------------------------------------------------

  private toCsv(value: Json): string {
    const rows = Array.isArray(value) ? value : [value]
    const columns = new Set<string>()
    for (const row of rows) {
      if (row && typeof row === 'object' && !Array.isArray(row)) {
        for (const key of Object.keys(row)) columns.add(key)
      }
    }
    const header = [...columns]
    const lines = [header.map((c) => this.csvCell(c)).join(',')]
    for (const row of rows) {
      const obj = (row && typeof row === 'object' && !Array.isArray(row) ? row : {}) as Record<
        string,
        Json
      >
      lines.push(
        header
          .map((col) => {
            const cell = obj[col]
            const text =
              cell === null || cell === undefined
                ? ''
                : typeof cell === 'object'
                  ? JSON.stringify(cell)
                  : String(cell)
            return this.csvCell(text)
          })
          .join(',')
      )
    }
    return lines.join('\n')
  }

  private csvCell(value: string): string {
    return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
  }

  // --- XML ------------------------------------------------------------------

  private toXml(value: Json): string {
    const body = this.xmlNode('document', value, 1)
    return `<?xml version="1.0" encoding="UTF-8"?>\n<icf>\n${body}\n</icf>`
  }

  private xmlNode(name: string, value: Json, depth: number): string {
    const pad = '  '.repeat(depth)
    const tag = this.xmlName(name)
    if (Array.isArray(value)) {
      return value.map((item) => this.xmlNode('item', item, depth)).join('\n')
    }
    if (value && typeof value === 'object') {
      const children = Object.entries(value)
        .map(([key, child]) => this.xmlNode(key, child, depth + 1))
        .join('\n')
      return `${pad}<${tag}>\n${children}\n${pad}</${tag}>`
    }
    return `${pad}<${tag}>${this.xmlEscape(value)}</${tag}>`
  }

  private xmlName(name: string): string {
    const safe = name.replace(/[^A-Za-z0-9_.-]/g, '_')
    return /^[A-Za-z_]/.test(safe) ? safe : `_${safe}`
  }

  private xmlEscape(value: Json): string {
    if (value === null) return ''
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  }

  // --- YAML -----------------------------------------------------------------

  private toYaml(value: Json, depth = 0): string {
    const pad = '  '.repeat(depth)
    if (Array.isArray(value)) {
      if (value.length === 0) return `${pad}[]`
      return value
        .map((item) => {
          if (item && typeof item === 'object') {
            const block = this.toYaml(item, depth + 1).replace(/^ +/, '')
            return `${pad}- ${block.split('\n').join(`\n${pad}  `)}`
          }
          return `${pad}- ${this.yamlScalar(item)}`
        })
        .join('\n')
    }
    if (value && typeof value === 'object') {
      const entries = Object.entries(value)
      if (entries.length === 0) return `${pad}{}`
      return entries
        .map(([key, child]) => {
          if (child && typeof child === 'object') {
            return `${pad}${key}:\n${this.toYaml(child, depth + 1)}`
          }
          return `${pad}${key}: ${this.yamlScalar(child)}`
        })
        .join('\n')
    }
    return `${pad}${this.yamlScalar(value)}`
  }

  private yamlScalar(value: Json): string {
    if (value === null) return 'null'
    const text = String(value)
    return /[:#\-?{}[\],&*!|>'"%@`]/.test(text) || text === '' || /^\s|\s$/.test(text)
      ? JSON.stringify(text)
      : text
  }
}
