import { ICFParserService } from './ICFParserService'
import { ICFWriterService } from './ICFWriterService'
import { ICFValidatorService } from './ICFValidatorService'
import { ICXGeneratorService } from './ICXGeneratorService'
import { ICXParserService } from './ICXParserService'
import { SearchService } from './SearchService'
import { MergeService } from './MergeService'
import { SplitService } from './SplitService'
import { StatisticsService } from './StatisticsService'
import { ExportService } from './ExportService'
import { UndoService } from './UndoService'
import { SettingsService } from './SettingsService'
import { RecordEditService } from './RecordEditService'
import { ImportService } from './ImportService'

/**
 * Minimal dependency-injection container. Services are constructed once and
 * shared; tests construct services directly (or a fresh container) so nothing
 * here is a hard singleton. Views resolve services via {@link useServices}.
 */
export class ServiceContainer {
  readonly parser = new ICFParserService()
  readonly writer = new ICFWriterService()
  readonly validator = new ICFValidatorService()
  readonly icxGenerator = new ICXGeneratorService()
  readonly icxParser = new ICXParserService()
  readonly statistics = new StatisticsService()
  readonly search = new SearchService()
  readonly merge = new MergeService(this.writer)
  readonly split = new SplitService(this.writer)
  readonly export = new ExportService(this.writer, this.icxGenerator)
  readonly undo = new UndoService()
  readonly settings = new SettingsService()
  readonly recordEdit = new RecordEditService()
  readonly import = new ImportService()
}

export const services = new ServiceContainer()
