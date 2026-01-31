export namespace core {
	
	export class SetupResult {
	    dataKey: string;
	
	    static createFrom(source: any = {}) {
	        return new SetupResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.dataKey = source["dataKey"];
	    }
	}

}

export namespace database {
	
	export class Settings {
	    AutoLockMinutes: number;
	    LockOnMinimize: boolean;
	    LockOnSleep: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Settings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.AutoLockMinutes = source["AutoLockMinutes"];
	        this.LockOnMinimize = source["LockOnMinimize"];
	        this.LockOnSleep = source["LockOnSleep"];
	    }
	}

}

export namespace notebooks {
	
	export class Notebook {
	    id: string;
	    name: string;
	    icon: string;
	    sortOrder: number;
	    pinned: boolean;
	    createdAt: string;
	    updatedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new Notebook(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.icon = source["icon"];
	        this.sortOrder = source["sortOrder"];
	        this.pinned = source["pinned"];
	        this.createdAt = source["createdAt"];
	        this.updatedAt = source["updatedAt"];
	    }
	}

}

export namespace notes {
	
	export class Tag {
	    id: string;
	    name: string;
	    color: string;
	
	    static createFrom(source: any = {}) {
	        return new Tag(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.color = source["color"];
	    }
	}
	export class Note {
	    id: string;
	    title: string;
	    content: string;
	    createdAt: string;
	    updatedAt: string;
	    pinned: boolean;
	    deletedAt?: string;
	    notebookId?: string;
	    tags: Tag[];
	
	    static createFrom(source: any = {}) {
	        return new Note(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.content = source["content"];
	        this.createdAt = source["createdAt"];
	        this.updatedAt = source["updatedAt"];
	        this.pinned = source["pinned"];
	        this.deletedAt = source["deletedAt"];
	        this.notebookId = source["notebookId"];
	        this.tags = this.convertValues(source["tags"], Tag);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ListResult {
	    notes: Note[];
	    total: number;
	
	    static createFrom(source: any = {}) {
	        return new ListResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.notes = this.convertValues(source["notes"], Note);
	        this.total = source["total"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	

}

export namespace smartviews {
	
	export class FilterCondition {
	    field: string;
	    operator: string;
	    value: string;
	
	    static createFrom(source: any = {}) {
	        return new FilterCondition(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.field = source["field"];
	        this.operator = source["operator"];
	        this.value = source["value"];
	    }
	}
	export class Filter {
	    conditions?: FilterCondition[];
	    tagIds?: string[];
	    notebookId?: string;
	    daysRecent?: number;
	    searchQuery?: string;
	
	    static createFrom(source: any = {}) {
	        return new Filter(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.conditions = this.convertValues(source["conditions"], FilterCondition);
	        this.tagIds = source["tagIds"];
	        this.notebookId = source["notebookId"];
	        this.daysRecent = source["daysRecent"];
	        this.searchQuery = source["searchQuery"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class SmartView {
	    id: string;
	    name: string;
	    icon: string;
	    filter: Filter;
	    sortOrder: number;
	
	    static createFrom(source: any = {}) {
	        return new SmartView(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.icon = source["icon"];
	        this.filter = this.convertValues(source["filter"], Filter);
	        this.sortOrder = source["sortOrder"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace tags {
	
	export class Tag {
	    id: string;
	    name: string;
	    color: string;
	
	    static createFrom(source: any = {}) {
	        return new Tag(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.color = source["color"];
	    }
	}

}

