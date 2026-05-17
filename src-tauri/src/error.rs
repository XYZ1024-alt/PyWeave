use pyo3::exceptions::PyBaseException;
use pyo3::prelude::*;
use pyo3::types::{PyAnyMethods, PyTracebackMethods, PyTypeMethods};
use serde::Serialize;

const TRACE_FILE_MARKER: &str = "File \"<pyweave_algorithm>\", line ";

#[derive(Debug, Serialize)]
pub struct TraceExecutionError {
    pub kind: String,
    pub line: Option<usize>,
    pub message: String,
}

impl TraceExecutionError {
    pub fn from_py_err(py: Python<'_>, error: PyErr) -> Self {
        let kind = error_kind(py, &error);
        let line = syntax_line(error.value(py)).or_else(|| traceback_line(py, &error));
        let message = error_message(py, &error);

        Self {
            kind,
            line,
            message,
        }
    }
}

fn error_kind(py: Python<'_>, error: &PyErr) -> String {
    error
        .get_type(py)
        .name()
        .map(|name| name.to_string())
        .unwrap_or_else(|_| "PythonError".to_owned())
}

fn error_message(py: Python<'_>, error: &PyErr) -> String {
    error
        .value(py)
        .str()
        .map(|message| message.to_string())
        .unwrap_or_else(|_| "Python execution failed".to_owned())
}

fn syntax_line(value: &Bound<'_, PyBaseException>) -> Option<usize> {
    value.getattr("lineno").ok()?.extract().ok()
}

fn traceback_line(py: Python<'_>, error: &PyErr) -> Option<usize> {
    let formatted = error.traceback(py)?.format().ok()?;
    formatted.lines().rev().find_map(parse_trace_line)
}

fn parse_trace_line(line: &str) -> Option<usize> {
    let start = line.find(TRACE_FILE_MARKER)? + TRACE_FILE_MARKER.len();
    let tail = &line[start..];
    let digits: String = tail
        .chars()
        .take_while(|char| char.is_ascii_digit())
        .collect();
    digits.parse().ok()
}

#[cfg(test)]
mod tests {
    use pyo3::{Python, types::PyAnyMethods};

    use super::TraceExecutionError;

    #[test]
    fn formats_syntax_error_line() {
        Python::attach(|py| {
            let error = py
                .import("builtins")
                .unwrap()
                .getattr("compile")
                .unwrap()
                .call1(("x =\n", "<pyweave_algorithm>", "exec"))
                .unwrap_err();
            let formatted = TraceExecutionError::from_py_err(py, error);

            assert_eq!(formatted.kind, "SyntaxError");
            assert_eq!(formatted.line, Some(1));
            assert!(formatted.message.contains("invalid syntax"));
        });
    }
}
