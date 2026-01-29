import { notes, tags, database, main, notebooks, smartviews } from './models';

export function IsFirstRun(): Promise<boolean>;
export function SetupPassword(password: string, hint: string): Promise<main.SetupResult>;
export function VerifyDataKey(displayKey: string): Promise<boolean>;
export function Unlock(password: string): Promise<boolean>;
export function Lock(): Promise<void>;
export function IsUnlocked(): Promise<boolean>;
export function GetPasswordHint(): Promise<string>;
export function ChangePassword(oldPassword: string, newPassword: string, newHint: string): Promise<void>;
export function ResetPasswordWithDataKey(displayKey: string, newPassword: string, newHint: string): Promise<void>;
export function UpdateActivity(): Promise<void>;
export function GetDataDir(): Promise<string>;
export function GetVersion(): Promise<string>;

export function CreateNote(title: string, content: string): Promise<notes.Note>;
export function GetNote(id: string): Promise<notes.Note>;
export function UpdateNote(id: string, title: string, content: string): Promise<notes.Note>;
export function SetNotePinned(id: string, pinned: boolean): Promise<void>;
export function SoftDeleteNote(id: string): Promise<void>;
export function RestoreNote(id: string): Promise<void>;
export function DeleteNote(id: string): Promise<void>;
export function ListNotes(): Promise<notes.Note[]>;
export function ListDeletedNotes(): Promise<notes.Note[]>;
export function GetNoteHistory(noteID: string): Promise<notes.Note[]>;
export function RestoreNoteFromHistory(noteID: string, historyID: string): Promise<notes.Note>;

export function CreateTag(name: string, color: string): Promise<tags.Tag>;
export function UpdateTag(id: string, name: string, color: string): Promise<tags.Tag>;
export function DeleteTag(id: string): Promise<void>;
export function ListTags(): Promise<tags.Tag[]>;
export function AddTagToNote(noteID: string, tagID: string): Promise<void>;
export function RemoveTagFromNote(noteID: string, tagID: string): Promise<void>;

export function GetSettings(): Promise<database.Settings>;
export function UpdateSettings(autoLockMinutes: number, lockOnMinimize: boolean, lockOnSleep: boolean): Promise<void>;

export function CreateBackup(): Promise<string>;
export function RestoreBackup(): Promise<void>;
export function ImportBackupWithKey(dataKey: string): Promise<number>;
export function ExportNoteAsMarkdown(noteID: string): Promise<string>;
export function ImportMarkdown(): Promise<notes.Note | null>;

export function CreateNotebook(name: string, icon: string): Promise<notebooks.Notebook>;
export function UpdateNotebook(id: string, name: string, icon: string): Promise<notebooks.Notebook>;
export function DeleteNotebook(id: string): Promise<void>;
export function ListNotebooks(): Promise<notebooks.Notebook[]>;
export function ReorderNotebooks(ids: string[]): Promise<void>;
export function SetNotebookPinned(id: string, pinned: boolean): Promise<void>;
export function SetNoteNotebook(noteID: string, notebookID: string | null): Promise<void>;
export function SetNotesNotebook(noteIDs: string[], notebookID: string | null): Promise<void>;
export function BatchDeleteNotes(noteIDs: string[]): Promise<void>;
export function BatchAddTagToNotes(noteIDs: string[], tagID: string): Promise<void>;
export function ReorderNotes(ids: string[]): Promise<void>;

export function CreateSmartView(name: string, icon: string, filter: smartviews.Filter): Promise<smartviews.SmartView>;
export function UpdateSmartView(id: string, name: string, icon: string, filter: smartviews.Filter): Promise<smartviews.SmartView>;
export function DeleteSmartView(id: string): Promise<void>;
export function ListSmartViews(): Promise<smartviews.SmartView[]>;
export function GetSmartView(id: string): Promise<smartviews.SmartView>;
