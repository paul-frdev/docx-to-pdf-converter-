export namespace main {
	
	export class AppConfigMetadata {
	    preserveMetadata: boolean;
	    engine: string;
	
	    static createFrom(source: any = {}) {
	        return new AppConfigMetadata(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.preserveMetadata = source["preserveMetadata"];
	        this.engine = source["engine"];
	    }
	}

}

