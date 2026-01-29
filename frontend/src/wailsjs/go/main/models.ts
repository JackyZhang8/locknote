export namespace notes {
  export interface Note {
    id: string;
    title: string;
    content: string;
    createdAt: string;
    updatedAt: string;
    pinned: boolean;
    deletedAt?: string;
    notebookId?: string;
    tags: Tag[];
  }

  export interface Tag {
    id: string;
    name: string;
    color: string;
  }
}

export namespace tags {
  export interface Tag {
    id: string;
    name: string;
    color: string;
  }
}

export namespace database {
  export interface Settings {
    AutoLockMinutes: number;
    LockOnMinimize: boolean;
    LockOnSleep: boolean;
  }
}

export namespace main {
  export interface SetupResult {
    dataKey: string;
  }
}

export namespace notebooks {
  export interface Notebook {
    id: string;
    name: string;
    icon: string;
    sortOrder: number;
    pinned: boolean;
  }
}

export namespace smartviews {
  export interface FilterCondition {
    field: string;
    operator: string;
    value: string;
  }

  export interface Filter {
    conditions?: FilterCondition[];
    tagIds?: string[];
    notebookId?: string;
    daysRecent?: number;
    searchQuery?: string;
  }

  export interface SmartView {
    id: string;
    name: string;
    icon: string;
    filter?: Filter;
    filterJson?: string;
    sortOrder: number;
  }
}
