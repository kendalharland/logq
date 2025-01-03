# logq

A browser extension that can be use to transform log output.

# Installation

1. Clone this repository
2. In your browser: visit chrome://extensions
3. Enable Developer mode (top-right corner)
4. Click 'Load unpacked' (top-left corner)
5. Select the directory where you cloned this extension
6. To test, visit any failed GitHub job run's raw log page and press the down arrow.

# Usage

This extension runs automatically when you visit a URL like `https://*.blob.core.windows.net/actions-results/*`.
After a small delay, it will do the following:

- Process all log lines on the page using the rules you've previously configured.
- Jump to the next or previous matched log line when you press the up and down arrow keys.

# Configuration

The extensions options page is accessed differently based on which browser you are using:

- **Chrome**: To open the options page, click the extension and select 'Options'.
- **Arc**: To open the options page, open the command bar and type "logq"

## Operation

This extension performs a fuzzy match to find the log lines of interest, then runs a more powerful
log-processing pipeline on those matched lines. The pipeline is specified using a domain-specific 
language similar to that used by tools like `yq` and `jq`.

## Log Processing Pipeline

The pipline allows you to transform log lines using a syntax like: `{{_}} | command1() | command2() | ...`

The initial `{{_}}` represents the input log line. This can be used anywhere in the pipeline to refer to the
original input line. `{{}}` represents the input to the current pipeline stage (output of previous stage). 

Commands are chained with `|` operators.

Any value that is not a function call or a `{{...}}` expression is interpreted as a string template. For example:
`uppercase | <a href="https://example.com">{{}}</a>` will print a hyperlink with the input log line convert to
uppercase as the link text.

## Commands

### match(regex)
Extracts text using regular expressions.

**Input**: Log line string  
**Arguments**: Regular expression pattern  
**Returns**: Array `[matched_text, full_line]`

```
{{_}} | match(/error/) 
// For line "system error occurred", returns:
// ["error", "system error occurred"]
```

### uppercase()
Converts text to uppercase.

**Input**: String  
**Returns**: Uppercase string

```
{{_}} | match(/error/) | uppercase()
// For line "system error occurred", returns:
// ["ERROR", "system error occurred"]
// The first and last values can be accessed with {{0}} and {{1}}
```

### fallback(default)
Provides default value for empty/null/undefined inputs.

**Input**: Any value  
**Arguments**: Default value string  
**Returns**: Input value if valid, otherwise default string

```
{{_}} | match(/missing/) | fallback("no match")
// For line without "missing", returns: "no match"
// For line with "missing", returns the output of `match`
```

## Example
```
{{_}} | match(/foo/) | fallback("not found") | uppercase()
// Matches "foo", falls back to "not found" if no match, converts result to uppercase
```

# Design Notes

## 1. Fuzzy searching algorithms

There are a lot of options to choose from:

### lunr.js

Very fast and simple to use but has limited pattern matching functionality.
No support for regex so users can't use things like match groups to transform
output.

### [fuse.js](https://www.fusejs.io/demo.html)

TODO