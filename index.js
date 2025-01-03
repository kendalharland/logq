// TODO: Try https://www.fusejs.io/ which seems to have a more friendly matching syntax.
//       At the moment it's impossible to e.g. capture regexes and add context links to the page.
// TODO: You can't apply global transformations such as relative timestamp conversions.
// TODO: You can't use this extension on website URLs where it isn't allowlisted (See https://stackoverflow.com/questions/12433271/can-i-allow-the-extension-user-to-choose-matching-domains)
// TODO: It's hard to tell which highlighted line is selected when navigating with the arrow keys.
// TODO: There's no documentation for new users.

class LineScanner {
    constructor(input) {
        this.input = input;
    }

    get length() {
        let count = 1; // Start at 1 since even a string without \n has one line
        let pos = 0;

        // Handle special case of empty string
        if (this.input.length === 0) {
            return 0;
        }

        while ((pos = this.input.indexOf('\n', pos)) !== -1) {
            count++;
            pos++; // Move past the newline
        }

        // Don't count a trailing newline as an extra line
        if (this.input.endsWith('\n')) {
            count--;
        }

        return count;
    }

    forEach(callback) {
        if (this.input.length === 0) {
            return;
        }

        let start = 0;
        let pos = 0;

        while (true) {
            pos = this.input.indexOf('\n', start);

            if (pos === -1) {
                // Handle the last line (or only line if no newlines)
                if (start < this.input.length) {
                    callback(this.input.slice(start));
                }
                break;
            }

            // Extract the line without the newline character
            callback(this.input.slice(start, pos));

            start = pos + 1;
        }
    }
}

class TextRangeMapper {
    constructor(text) {
        this.text = text;
        this.lineStarts = [];
        this.rangesByLine = new Map(); // Map<lineNumber, Array<{start, length, callback}>>

        // Build index of line start positions
        let pos = 0;
        this.lineStarts.push(0);

        while ((pos = text.indexOf('\n', pos)) !== -1) {
            this.lineStarts.push(pos + 1);
            pos++;
        }
    }

    // Add a range specified as [offset, length, callback]
    addRange(offset, length, callback) {
        const range = {
            start: offset,
            end: offset + length,
            callback
        };

        // Find which lines this range intersects with
        const startLine = this._findLineNumber(range.start);
        const endLine = this._findLineNumber(range.end);

        // Add the range to each line it intersects with
        for (let line = startLine; line <= endLine; line++) {
            if (!this.rangesByLine.has(line)) {
                this.rangesByLine.set(line, []);
            }

            // Convert to line-relative coordinates
            const lineStart = this.lineStarts[line];
            const lineEnd = line < this.lineStarts.length - 1
                ? this.lineStarts[line + 1] - 1
                : this.text.length;

            this.rangesByLine.get(line).push({
                start: Math.max(0, range.start - lineStart),
                length: Math.min(range.end, lineEnd) - Math.max(range.start, lineStart),
                callback: range.callback
            });
        }
    }

    // Add multiple ranges at once
    addRanges(ranges) {
        for (const [offset, length, callback] of ranges) {
            this.addRange(offset, length, callback);
        }
    }

    // Binary search to find which line contains a given offset
    _findLineNumber(offset) {
        let low = 0;
        let high = this.lineStarts.length - 1;

        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            const lineStart = this.lineStarts[mid];
            const lineEnd = mid < this.lineStarts.length - 1
                ? this.lineStarts[mid + 1] - 1
                : this.text.length;

            if (offset >= lineStart && offset <= lineEnd) {
                return mid;
            } else if (offset < lineStart) {
                high = mid - 1;
            } else {
                low = mid + 1;
            }
        }

        return Math.min(low, this.lineStarts.length - 1);
    }

    // Get all ranges and their callbacks for a given line number
    getRanges(lineNumber) {
        if (lineNumber < 0 || lineNumber >= this.lineStarts.length) {
            return [];
        }

        return this.rangesByLine.get(lineNumber) || [];
    }

    // Execute all callbacks for ranges that intersect with the given line
    processLine(lineNumber) {
        const ranges = this.getRanges(lineNumber);
        const line = this.getLine(lineNumber);

        if (line === undefined) return;

        for (const range of ranges) {
            range.callback(line);
        }
    }

    // Utility method to get the text of a specific line
    getLine(lineNumber) {
        if (lineNumber < 0 || lineNumber >= this.lineStarts.length) {
            return undefined;
        }

        const start = this.lineStarts[lineNumber];
        const end = lineNumber < this.lineStarts.length - 1
            ? this.lineStarts[lineNumber + 1] - 1
            : this.text.length;

        return this.text.slice(start, end);
    }
}

class PipelineInterpreter {
    constructor() {
        // Input of the currently executing program.
        this.currentProgramInput = "";

        // Terminate early. Usable by built-in functions
        this.exitEarlyOk = false;

        // Built-in functions
        this.functions = {
            uppercase: (value) => value.toUpperCase(),
            match: (value, regex) => {
                const match = value.match(regex);
                console.log(`Match is ${match}`);
                if (!match) return null;
                return match; // Return the full match array
            },
            fallback: (value, fallback_value) => {
                console.log(`calling fallback: ((${value})) ((${fallback_value}))`);
                if (!value) {
                    this.exitEarlyOk = true;
                    return fallback_value;
                }
                return value;
            }
        };
    }

    // Register a new pipeline function
    registerFunction(name, fn) {
        this.functions[name] = fn;
    }

    // Main interpret function
    interpret(input, program) {
        this.currentProgramInput = input;

        let value = input;
        const stages = this._parsePipeline(program);
        for (const stage of stages) {
            value = this._executeStage(stage, value);
            if (this.exitEarlyOk) {
                console.log("exiting early");
                this.exitEarlyOk = false;
                break;
            }
        }

        this.currentProgramInput = "";

        return value;
    }

    // Parse pipeline into stages
    _parsePipeline(program) {
        return program
            .split('|')
            .map(stage => stage.trim())
            .filter(stage => stage.length > 0);
    }

    // Execute a single pipeline stage
    _executeStage(stage, value) {
        // Handle string substitution stage (anything with {{}} syntax)
        if (stage.includes('{{')) {
            stage = this._processTemplate(stage, value);
        }

        // Handle function calls
        const functionMatch = stage.match(/([a-zA-Z]+)\((.*)\)/);
        if (functionMatch) {
            const [, fnName, argsStr] = functionMatch;
            const args = this._parseArgs(argsStr);
            return this.functions[fnName](value, ...args);
        }

        // Handle function calls without parentheses
        if (this.functions[stage]) {
            return this.functions[stage](value);
        }

        // Literal
        return stage;
        // throw new Error(`Invalid pipeline stage: ${stage}`);
    }

    // Parse function arguments
    _parseArgs(argsStr) {
        if (!argsStr.trim()) return [];

        const args = [];
        let current = '';
        let depth = 0;
        let inString = false;

        for (let i = 0; i < argsStr.length; i++) {
            const char = argsStr[i];

            if (char === '/' && argsStr[i + 1] !== ' ') {
                // Handle regex literals
                let j = i + 1;
                while (j < argsStr.length && argsStr[j] !== '/' || argsStr[j - 1] === '\\') j++;
                args.push(new RegExp(argsStr.slice(i + 1, j), "ig"));
                i = j;
                continue;
            }

            if (char === '"' && argsStr[i - 1] !== '\\') inString = !inString;
            if (!inString) {
                if (char === '(') depth++;
                if (char === ')') depth--;
            }

            if (char === ',' && depth === 0 && !inString) {
                args.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }

        if (current.trim()) args.push(current.trim());
        return args;
    }

    // Process a template string, replacing {{}} references
    _processTemplate(template, value) {
        console.log(`processing template with value ${value}`);

        template = template.replace(/{{_}}/g, this.currentProgramInput);

        if (value === null || value === undefined) {
            return template.replace(/{{[^}]*}}/g, '');
        }

        // Handle array-like value
        if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
            // Replace {{n}} with array indices
            template = template.replace(/{{(\d+)}}/g, (_, index) => {
                return value[index] !== undefined ? String(value[index]) : '';
            });

            // Replace {{}} with the entire array/object if it exists
            template = template.replace(/{{}}/g, () => {
                if (Array.isArray(value)) {
                    return value.join(',');
                }
                return String(value);
            });

            return template;
        }

        // Handle simple value
        return template.replace(/{{}}/g, String(value));
    }
}

function processHTMLDocument(text, searchResults) {
    // Split text into lines and track line start positions
    const lines = new LineScanner(text);

    // Store the matched ranges for fast line-based lookup.
    const ranges = new TextRangeMapper(text);

    for (const searchResult of searchResults) {
        for (const range of searchResult.ranges) {
            const offset = range[0];
            const length = range[1];
            ranges.addRange(offset, length, searchResult.processor);
        }
    }

    // Generate HTML with indexed IDs for highlighted lines
    let highlightIndex = 0;
    let lineNum = -1;
    let linesHtml = "";

    lines.forEach((line) => {
        lineNum++;
        const rangesOnLine = ranges.getRanges(lineNum);
        if (rangesOnLine.length > 0) {
            const range = rangesOnLine[0]; // The first matched range takes precendence over others on the same line.
            const processedLine = range.callback(line);
            linesHtml += `<span id="highlight-${highlightIndex++}" class="highlighted-line">${processedLine}</span>`;
        } else {
            linesHtml += line;
        }
        linesHtml += "\n";
    });

    // Return both the HTML and a function to initialize the navigation
    return {
        html: `
            <div id="transformed-log-output">
                ${linesHtml}
            </div>
        `,
        initializeNavigation: function () {
            let currentHighlight = -1;
            const highlightCount = highlightIndex;

            function navigateHighlights(direction) {
                if (highlightCount === 0) return;

                // Remove current highlight
                if (currentHighlight !== -1) {
                    document.getElementById('highlight-' + currentHighlight)
                        ?.classList.remove('current');
                }

                // Calculate new highlight position
                if (currentHighlight === -1) {
                    currentHighlight = direction > 0 ? 0 : highlightCount - 1;
                } else {
                    currentHighlight = (currentHighlight + direction + highlightCount) % highlightCount;
                }

                // Apply new highlight and scroll
                const element = document.getElementById('highlight-' + currentHighlight);
                if (element) {
                    element.classList.add('current');
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }

            // Add keyboard event listener
            document.addEventListener('keydown', (event) => {
                if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    navigateHighlights(1);
                } else if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    navigateHighlights(-1);
                }
            });
        }
    };
}

function processFailureLine(line) {
    const testMatch = line.match(/[tT]est[a-zA-Z_\-0-9]+/);
    if (testMatch) {
        const testName = testMatch[0];
        const baseUrl = "https://app.datadoghq.com/dashboard/ihd-vuj-2sr/flaky-test-investigation";
        const params = new URLSearchParams({
            fromUser: "false",
            refresh_mode: "sliding",
            "tpl_var_test_function[0]": testName,
            live: "true"
        });
        const url = `${baseUrl}?${params.toString()}`;
        line = `<span class="highlighted-line-content">${line}</span><a href="${url}" class="test-link">Check Test Flakiness</a>`;
    }

    return `<span class="highlighted-fail">${line}</span>`;
}

const DEFAULT_RULES = [
    {
        pattern: "error",
        processor: function (line) {
            return `<span class="highlighted-error">${line}</span>`;
        }
    },
    {
        pattern: "hint",
        processor: function (line) {
            return `<span class="highlighted-hint">${line}</span>`;
        }
    }
];

async function loadAndExecuteRules() {
    var documents = [{ name: 'Log', content: document.documentElement.innerHTML }];
    const index = lunr(function () {
        // Reference each match using this value.
        this.ref('name');

        // Search this field.
        this.field('content');

        // Allow lunr to tell us where matches occurred in the search text
        this.metadataWhitelist = ['position']

        documents.forEach(function (doc) {
            this.add(doc);
        }, this);
    });

    let rules = DEFAULT_RULES;

    const { highlightRules = [] } = await chrome.storage.local.get('highlightRules');
    const interpreter = new PipelineInterpreter();

    if (highlightRules && highlightRules.length > 0) {
        rules = highlightRules.map(rule => ({
            pattern: rule.pattern,
            processor: function (line) {
                // Remove newlines from program.
                const program = rule.replacement.replace(/\n/g, " ");
                const output = interpreter.interpret(line, program);
                console.log({
                    program: program,
                    input: line,
                    output: output,
                });
                return output;
                // return rule.replacement.replace("{{line}}", line);
            }
        }));
    }

    var results = []
    for (var rule of rules) {
        const searchResult = index.search(rule.pattern);

        if (searchResult.length == 0) {
            continue;
        }

        const firstResult = searchResult[0].matchData.metadata;
        if (searchResult.length > 0) {
            for (var entry of Object.entries(firstResult)) {
                results.push({
                    processor: rule.processor,
                    ranges: entry[1].content.position
                });
            }
        }
    }


    var highlightedHTML = processHTMLDocument(documents[0].content, results);

    document.body.innerHTML = highlightedHTML.html;
    highlightedHTML.initializeNavigation();
}

loadAndExecuteRules();
