/**
 * Editor Panes - Property editor components for PCEditor.
 *
 * Panes are standalone UI components that:
 * - Use only the PCEditor public API (treat editor as black box)
 * - Provide content-only rendering (no title bar/accordion)
 * - Apply changes immediately on blur/change
 * - Are framework-agnostic (vanilla JS)
 */

// Base class
export { BasePane } from './BasePane';

// Simple panes (Phase 2)
export { DocumentInfoPane } from './DocumentInfoPane';
export { ViewSettingsPane } from './ViewSettingsPane';
export type { ViewSettingsPaneOptions } from './ViewSettingsPane';
export { DocumentSettingsPane } from './DocumentSettingsPane';
export { MergeDataPane } from './MergeDataPane';
export type { MergeDataPaneOptions } from './MergeDataPane';
export { FormattingPane } from './FormattingPane';
export type { FormattingPaneOptions } from './FormattingPane';

// Field/Section panes (Phase 3)
export { HyperlinkPane } from './HyperlinkPane';
export type { HyperlinkData, HyperlinkPaneOptions } from './HyperlinkPane';
export { SubstitutionFieldPane } from './SubstitutionFieldPane';
export type { SubstitutionFieldPaneOptions } from './SubstitutionFieldPane';
export { RepeatingSectionPane } from './RepeatingSectionPane';
export type { RepeatingSectionPaneOptions } from './RepeatingSectionPane';
export { TableRowLoopPane } from './TableRowLoopPane';
export type { TableRowLoopPaneOptions } from './TableRowLoopPane';

// Object panes (Phase 4)
export { TextBoxPane } from './TextBoxPane';
export type { TextBoxPaneOptions } from './TextBoxPane';
export { ImagePane } from './ImagePane';
export type { ImagePaneOptions } from './ImagePane';
export { TablePane } from './TablePane';
export type { TablePaneOptions } from './TablePane';

// Types
export type {
  PaneOptions,
  PaneAttachOptions,
  BorderSideConfig,
  BorderConfig,
  CellPadding,
  CellUpdates,
  TableDefaults,
  HeaderStyle,
  TextBoxUpdates,
  ImageUpdates,
  ImageSourceOptions
} from './types';
