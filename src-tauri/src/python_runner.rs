use std::ffi::CString;

use pyo3::exceptions::PyValueError;
use pyo3::prelude::*;
use pyo3::types::PyDict;

use crate::python_policy;
use crate::tracer::{TraceCollector, TraceEvent};

const ALGORITHM_FILE: &str = "<pyweave_algorithm>";

const DRIVER_SCRIPT: &str = r#"
import sys

def _trace(frame, event, arg):
    _trace_collector.record(frame, event, arg)
    return _trace

sys.settrace(_trace)
try:
    exec(_compiled_algorithm, _algorithm_globals)
finally:
    sys.settrace(None)
"#;

pub fn run_sort_trace(source: &str) -> PyResult<Vec<TraceEvent>> {
    Python::attach(|py| {
        python_policy::validate_source(py, source)?;

        let collector = Py::new(py, TraceCollector::new(ALGORITHM_FILE))?;
        let globals = create_driver_globals(py, &collector)?;
        let algorithm_globals = python_policy::create_algorithm_globals(py)?;
        let compiled = compile_algorithm(py, source)?;

        globals.set_item("_compiled_algorithm", compiled)?;
        globals.set_item("_algorithm_globals", algorithm_globals)?;
        run_driver(py, &globals)?;

        let events = collector.borrow(py).events().to_vec();
        validate_timeline(events)
    })
}

fn validate_timeline(events: Vec<TraceEvent>) -> PyResult<Vec<TraceEvent>> {
    if events.is_empty() {
        return Err(PyValueError::new_err(
            "Python code executed without traceable line events",
        ));
    }

    Ok(events)
}

fn compile_algorithm<'py>(py: Python<'py>, source: &str) -> PyResult<Bound<'py, PyAny>> {
    let builtins = py.import("builtins")?;
    let compile = builtins.getattr("compile")?;

    compile.call1((source, ALGORITHM_FILE, "exec"))
}

fn create_driver_globals<'py>(
    py: Python<'py>,
    collector: &Py<TraceCollector>,
) -> PyResult<Bound<'py, PyDict>> {
    let globals = PyDict::new(py);
    globals.set_item("__builtins__", py.import("builtins")?)?;
    globals.set_item("_trace_collector", collector)?;
    Ok(globals)
}

fn run_driver(py: Python<'_>, globals: &Bound<'_, PyDict>) -> PyResult<()> {
    let driver = CString::new(DRIVER_SCRIPT)?;
    py.run(driver.as_c_str(), Some(globals), Some(globals))
}

#[cfg(test)]
mod tests {
    use pyo3::Python;
    use pyo3::types::PyTypeMethods;
    use serde_json::json;

    use super::run_sort_trace;

    #[test]
    fn captures_custom_function_name() {
        let source = r#"
def custom_increment(values):
    items = list(values)
    for i in range(len(items)):
        items[i] = items[i] + 1
    return items

answer = custom_increment([1, 2])
"#;

        let timeline = run_sort_trace(source).expect("custom function should trace");
        assert!(
            timeline
                .iter()
                .any(|event| { event.locals.get("items") == Some(&json!([2, 3])) })
        );
    }

    #[test]
    fn captures_top_level_custom_code() {
        let source = r#"
items = [3, 1]
for i in range(len(items)):
    items[i] = i
done = items
"#;

        let timeline = run_sort_trace(source).expect("top-level code should trace");
        assert!(
            timeline
                .iter()
                .any(|event| { event.locals.get("items") == Some(&json!([0, 1])) })
        );
    }

    #[test]
    fn allows_safe_builtin_algorithm_code() {
        let source = r#"
items = list(reversed([3, 1, 2]))
items = sorted(items)
total = sum(items)
"#;

        let timeline = run_sort_trace(source).expect("safe builtins should trace");
        assert!(
            timeline
                .iter()
                .any(|event| { event.locals.get("items") == Some(&json!([1, 2, 3])) })
        );
    }

    #[test]
    fn blocks_imports_by_default() {
        let source = r#"
items = [1]
import os
"#;

        let error = run_sort_trace(source).expect_err("imports should be rejected");
        Python::attach(|py| {
            assert_eq!(error.get_type(py).name().unwrap().to_string(), "ValueError");
            assert!(error.to_string().contains("PyWeave policy rejected line 3"));
            assert!(error.to_string().contains("Import is not available"));
        });
    }

    #[test]
    fn marks_unsupported_local_values() {
        let source = r#"
value = float("nan")
done = value
"#;

        let timeline = run_sort_trace(source).expect("unsupported locals should be marked");
        assert!(timeline.iter().any(|event| {
            event
                .locals
                .get("value")
                .and_then(|value| value.as_str())
                .is_some_and(|value| value.starts_with("<unsupported float:"))
        }));
    }

    #[test]
    fn returns_runtime_exception_without_panic() {
        let source = r#"
items = [1]
boom = items[3]
"#;

        let error = run_sort_trace(source).expect_err("runtime exception should be returned");
        Python::attach(|py| {
            assert_eq!(error.get_type(py).name().unwrap().to_string(), "IndexError");
        });
    }

    #[test]
    fn stops_when_trace_snapshot_is_too_large() {
        let source = r#"
items = list(range(100000))
done = len(items)
"#;

        let error = run_sort_trace(source).expect_err("large snapshots should stop execution");
        Python::attach(|py| {
            assert_eq!(
                error.get_type(py).name().unwrap().to_string(),
                "RuntimeError"
            );
            assert!(error.to_string().contains("Trace local snapshot exceeded"));
        });
    }

    #[test]
    fn stops_after_trace_limit() {
        let source = r#"
i = 0
while True:
    i = i + 1
"#;

        let error = run_sort_trace(source).expect_err("trace limit should stop execution");
        Python::attach(|py| {
            assert_eq!(
                error.get_type(py).name().unwrap().to_string(),
                "RuntimeError"
            );
            assert!(error.to_string().contains("Trace snapshot limit exceeded"));
        });
    }
}
