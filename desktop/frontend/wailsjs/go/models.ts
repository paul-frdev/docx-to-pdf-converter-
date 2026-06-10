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
	export class DesktopConversionResult {
	    success: boolean;
	    outputPath: string;
	    errorMessage: string;
	    durationMs: number;
	
	    static createFrom(source: any = {}) {
	        return new DesktopConversionResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.outputPath = source["outputPath"];
	        this.errorMessage = source["errorMessage"];
	        this.durationMs = source["durationMs"];
	    }
	}

}

