
//Creating Elements
var btn = document.createElement("BUTTON")
var t = document.createTextNode("CLICK ME");
btn.appendChild(t);
//Appending to DOM 
document.body.appendChild(btn);

logContents = document.documentElement.innerHTML;

var documents = [{ name: 'Log', content: logContents }];


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


function highlightSubstrings(text, ranges) {
    // Sort ranges by offset to process them in order
    ranges.sort((a, b) => a[0] - b[0]);
    
    // Validate ranges don't overlap
    for (let i = 0; i < ranges.length - 1; i++) {
        const currentEnd = ranges[i][0] + ranges[i][1];
        const nextStart = ranges[i + 1][0];
        if (currentEnd > nextStart) {
            throw new Error(`Overlapping ranges detected: ${ranges[i]} and ${ranges[i + 1]}`);
        }
    }
    
    // Process the string
    let result = '';
    let currentPos = 0;
    
    for (const [offset, length] of ranges) {
        // Add text before the highlight
        result += text.slice(currentPos, offset);
        
        // Add highlighted text
        const highlightedText = text.slice(offset, offset + length);
        result += `<span style="color: green">${highlightedText}</span>`;
        
        currentPos = offset + length;
    }
    
    // Add remaining text
    result += text.slice(currentPos);
    
    return result;
}

function highlightMatchedLines(text, ranges) {
    // Split text into lines and track line start positions
    const lines = text.split('\n');
    let lineStartPositions = [];
    let currentPosition = 0;
    
    for (const line of lines) {
        lineStartPositions.push(currentPosition);
        currentPosition += line.length + 1; // +1 for the newline character
    }
    
    // Create a Set to track which lines need highlighting
    const linesToHighlight = new Set();
    
    // For each range, find which line it belongs to
    for (const [offset, length] of ranges) {
        // Find the line that contains this range
        const lineIndex = lineStartPositions.findIndex((startPos, index) => {
            const nextLineStart = index < lines.length - 1 ? 
                lineStartPositions[index + 1] : text.length;
            return offset >= startPos && offset < nextLineStart;
        });
        
        if (lineIndex !== -1) {
            linesToHighlight.add(lineIndex);
        }
    }
    
    // CSS styles for the highlighted lines
    const highlightStyle = `
        display: block;
        background-color: #ffebee;
        color: #d32f2f;
        border-top: 1px solid #ffcdd2;
        border-bottom: 1px solid #ffcdd2;
        padding: 2px 4px;
        margin: 2px 0;
        line-height: 1.4;
    `;
    
    // Build the result by wrapping highlighted lines in styled spans
    const result = lines
        .map((line, index) => 
            linesToHighlight.has(index) 
                ? `<span style="${highlightStyle}">${line}</span>` 
                : line
        )
        .join('\n');
    
    return result;
}

function collapseUnmatchedLines(text, ranges) {
    // Split text into lines and track line start positions
    const lines = text.split('\n');
    let lineStartPositions = [];
    let currentPosition = 0;
    
    for (const line of lines) {
        lineStartPositions.push(currentPosition);
        currentPosition += line.length + 1;
    }
    
    // Create a Set to track which lines need highlighting
    const linesToHighlight = new Set();
    
    // For each range, find which line it belongs to
    for (const [offset, length] of ranges) {
        const lineIndex = lineStartPositions.findIndex((startPos, index) => {
            const nextLineStart = index < lines.length - 1 ? 
                lineStartPositions[index + 1] : text.length;
            return offset >= startPos && offset < nextLineStart;
        });
        
        if (lineIndex !== -1) {
            linesToHighlight.add(lineIndex);
        }
    }
    
    // CSS styles
    const styles = `
        <style>
            .highlighted-line {
                display: block;
                background-color: #ffebee;
                color: #d32f2f;
                border-top: 1px solid #ffcdd2;
                border-bottom: 1px solid #ffcdd2;
                padding: 2px 4px;
                margin: 2px 0;
                line-height: 1.4;
            }
            .collapse-button {
                background-color: #e0e0e0;
                border: 1px solid #bdbdbd;
                color: #424242;
                padding: 4px 8px;
                margin: 4px auto;
                cursor: pointer;
                display: block;
                width: fit-content;
                min-width: 150px;
                text-align: center;
                font-family: monospace;
                border-radius: 4px;
                font-size: 14px;
            }
            .collapse-button:hover {
                background-color: #bdbdbd;
            }
            .hidden-lines {
                display: none;
                white-space: pre-wrap;
                font-family: monospace;
                padding: 4px;
                background-color: #fafafa;
            }
            .hidden-lines.visible {
                display: block;
            }
        </style>
    `;
    
    // Group consecutive lines into sections (highlighted or not)
    let sections = [];
    let currentSection = { highlighted: false, lines: [] };
    
    lines.forEach((line, index) => {
        const isHighlighted = linesToHighlight.has(index);
        
        if (currentSection.lines.length === 0) {
            currentSection.highlighted = isHighlighted;
            currentSection.lines.push(line);
        } else if (currentSection.highlighted === isHighlighted) {
            currentSection.lines.push(line);
        } else {
            sections.push(currentSection);
            currentSection = { highlighted: isHighlighted, lines: [line] };
        }
    });
    sections.push(currentSection);
    
    // Generate HTML for each section
    let sectionId = 0;
    const sectionsHtml = sections.map(section => {
        if (section.highlighted) {
            return section.lines
                .map(line => `<span class="highlighted-line">${line}</span>`)
                .join('\n');
        } else {
            const id = `hidden-section-${sectionId++}`;
            return `
                <button class="collapse-button" onclick="toggleSection('${id}')">
                    Show ${section.lines.length} line${section.lines.length > 1 ? 's' : ''}
                </button>
                <div id="${id}" class="hidden-lines">
                    ${section.lines.join('\n')}
                </div>
            `;
        }
    }).join('\n');
    
    // JavaScript for toggling sections
    const script = `
        <script>
            function toggleSection(id) {
                const element = document.getElementById(id);
                element.classList.toggle('visible');
                const button = element.previousElementSibling;
                const lineCount = element.textContent.trim().split('\\n').length;
                button.textContent = element.classList.contains('visible') 
                    ? \`Hide \${lineCount} line\${lineCount > 1 ? 's' : ''}\`
                    : \`Show \${lineCount} line\${lineCount > 1 ? 's' : ''}\`;
            }
        </script>
    `;
    
    // Combine everything into a container div
    return `
        <div id="highlight-container">
            ${styles}
            ${sectionsHtml}
            ${script}
        </div>
    `;
}

function highlightWithKeynav(text, ranges, containerId = 'highlight-container') {
    // Split text into lines and track line start positions
    const lines = text.split('\n');
    let lineStartPositions = [];
    let currentPosition = 0;
    
    for (const line of lines) {
        lineStartPositions.push(currentPosition);
        currentPosition += line.length + 1;
    }
    
    // Create a Set to track which lines need highlighting
    const linesToHighlight = new Set();
    
    // For each range, find which line it belongs to
    for (const [offset, length] of ranges) {
        const lineIndex = lineStartPositions.findIndex((startPos, index) => {
            const nextLineStart = index < lines.length - 1 ? 
                lineStartPositions[index + 1] : text.length;
            return offset >= startPos && offset < nextLineStart;
        });
        
        if (lineIndex !== -1) {
            linesToHighlight.add(lineIndex);
        }
    }
    
    // CSS styles
    const styles = `
        <style>
            .highlighted-line {
                display: block;
                background-color: #ffebee;
                color: #d32f2f;
                border-top: 1px solid #ffcdd2;
                border-bottom: 1px solid #ffcdd2;
                padding: 2px 4px;
                margin: 2px 0;
                line-height: 1.4;
                scroll-margin-top: 20px;
            }
            .highlighted-line.current {
                background-color: #ef9a9a;
                border-top: 1px solid #e57373;
                border-bottom: 1px solid #e57373;
            }
            #${containerId} {
                position: relative;
            }
        </style>
    `;
    
    // Generate HTML with indexed IDs for highlighted lines
    let highlightIndex = 0;
    const linesHtml = lines.map((line, index) => {
        if (linesToHighlight.has(index)) {
            return `<span id="highlight-${highlightIndex++}" class="highlighted-line">${line}</span>`;
        }
        return line;
    }).join('\n');
    
    // Return both the HTML and a function to initialize the navigation
    return {
        html: `
            <div id="${containerId}">
                ${styles}
                ${linesHtml}
            </div>
        `,
        initializeNavigation: function() {
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

function highlightTestFlakes(text, ranges, containerId = 'highlight-container') {
    // Split text into lines and track line start positions
    const lines = text.split('\n');
    let lineStartPositions = [];
    let currentPosition = 0;
    
    for (const line of lines) {
        lineStartPositions.push(currentPosition);
        currentPosition += line.length + 1;
    }
    
    // Create a Set to track which lines need highlighting
    const linesToHighlight = new Set();
    
    // For each range, find which line it belongs to
    for (const [offset, length] of ranges) {
        const lineIndex = lineStartPositions.findIndex((startPos, index) => {
            const nextLineStart = index < lines.length - 1 ? 
                lineStartPositions[index + 1] : text.length;
            return offset >= startPos && offset < nextLineStart;
        });
        
        if (lineIndex !== -1) {
            linesToHighlight.add(lineIndex);
        }
    }
    
    // CSS styles
    const styles = `
        <style>
            .highlighted-line {
                display: block;
                background-color: #ffebee;
                color: #d32f2f;
                border-top: 1px solid #ffcdd2;
                border-bottom: 1px solid #ffcdd2;
                padding: 2px 4px;
                margin: 2px 0;
                line-height: 1.4;
                scroll-margin-top: 20px;
            }
            .highlighted-line.current {
                background-color: #ef9a9a;
                border-top: 1px solid #e57373;
                border-bottom: 1px solid #e57373;
            }
            .test-link {
                display: block;
                font-size: 0.9em;
                margin-top: 4px;
                color: #1976d2;
                text-decoration: none;
            }
            .test-link:hover {
                text-decoration: underline;
            }
            #${containerId} {
                position: relative;
            }
        </style>
    `;
    
    // Function to extract test name and create link
    function processLine(line) {
        const testMatch = line.match(/test[a-zA-Z_\-0-9]+/);
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
            return `<span class="highlighted-line-content">${line}</span><a href="${url}" class="test-link">Check if ${testName} is Flaky</a>`;
        }
        return line;
    }
    
    // Generate HTML with indexed IDs for highlighted lines
    let highlightIndex = 0;
    const linesHtml = lines.map((line, index) => {
        if (linesToHighlight.has(index)) {
            const processedLine = processLine(line);
            return `<span id="highlight-${highlightIndex++}" class="highlighted-line">${processedLine}</span>`;
        }
        return line;
    }).join('\n');
    
    // Return both the HTML and a function to initialize the navigation
    return {
        html: `
            <div id="${containerId}">
                ${styles}
                ${linesHtml}
            </div>
        `,
        initializeNavigation: function() {
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

const results = index.search("error");
console.log(results);
console.log(results[0]);
console.log(results[0].matchData);

var highlightedContent = highlightTestFlakes(
  documents[0].content,
  results[0].matchData.metadata.error.content.position
);

/*
console.log(highlightedContent);
document.open();
document.write("<html><body>");
document.write(highlightedContent);
document.write("</body></html>");
document.close();
*/
document.body.innerHTML = highlightedContent.html;
highlightedContent.initializeNavigation();
